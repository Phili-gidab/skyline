"""
The office's three Google Sheets -> an import spec for php-api/import-boards.php.

    python tools/sheets-to-boards.py <folder of .xlsx exports> <out.json>

The spreadsheets were typed by hand over a year, so most of this file is
cleaning: "Registerd", "Succesfull", "FALES", five spellings of "full service",
phone numbers that lost their leading 0 when the sheet stored them as numbers.

It is also careful about passwords. Staff typed portal logins straight into the
university and tax-code columns ("Palermo: <password>", "Messina <password>").
Nothing that could be a credential is ever put in a visible column: a university
name is shown only when it is plainly a name, and the whole original cell always
goes into an encrypted field beside it. Anything unrecognised goes to the
encrypted field too — it is better to hide a harmless note than show a password.

The output contains those passwords in plain text. It is sealed on the server by
the importer; delete the JSON as soon as the import has run.
"""

import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

import openpyxl

SOURCES = {
    'register': '1-opA-feTOHNW3bzWl9701rh7OcpmuBzmcdGMRVsWHmY',
    'applications': '1zC1cawGn5lvhLYIcqMWeqDUSGOpcqbU00_zzq3OV3_M',
    'italy': '1zOTG7_smHix5XLXKmTDcViEvEpSfnfsnoBVN-0ryoSo',
}

CLEAN_NAME = re.compile(r"^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'&()/]*$")
TAX_CODE = re.compile(r'^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$')
EMAIL = re.compile(r'^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$')

report = []


def rows_of(ws):
    rows = [r for r in ws.iter_rows(values_only=True)]
    # the header is the first row with three or more filled cells — some tabs
    # start with blank rows, and a blank row taken as the header loses the tab
    at = next((i for i, r in enumerate(rows) if sum(1 for c in r if c not in (None, '')) >= 3), None)
    if at is None:
        return []
    head = [str(c).strip() if c is not None else '' for c in rows[at]]
    out = []
    for n, r in enumerate(rows[at + 1:], start=at + 2):
        rec = {head[i]: r[i] for i in range(min(len(head), len(r))) if head[i]}
        if any(v not in (None, '') and v is not False for v in rec.values()):
            out.append((n, rec))
    return out


def s(v):
    if v is None:
        return ''
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return re.sub(r'\s+', ' ', str(v)).strip()


def phone(v):
    t = s(v).replace(' ', '')
    if re.fullmatch(r'[79]\d{8}', t):  # the sheet stored 0911… as a number and dropped the 0
        t = '0' + t
    return t or None


def money(v):
    """(amount, leftover text) — a value like "PACKAGE" is kept as a note."""
    if v in (None, ''):
        return None, None
    if isinstance(v, (int, float)):
        return (int(v) if float(v).is_integer() else float(v)), None
    t = s(v).replace(',', '').replace(' ', '')
    try:
        return (float(t) if '.' in t else int(t)), None
    except ValueError:
        return None, s(v)


def canon(v, table, default=None):
    key = re.sub(r'[^a-z0-9]+', ' ', s(v).lower()).strip()
    if not key:
        return None
    for pattern, out in table:
        if re.fullmatch(pattern, key):
            return out
    return default if default is not None else s(v)


def destination(v):
    parts = [p.strip() for p in re.split(r'[,+/]| and ', s(v)) if p.strip()]
    names = []
    for p in parts:
        k = p.lower().replace(' ', '')
        name = {'iceland': 'Iceland', 'usa': 'USA', 'schengenvisit': 'Schengen visit', 'other': 'Other'}.get(k, p.strip().title())
        if name not in names:
            names.append(name)
    if len(names) > 1 and 'Other' in names:
        names.remove('Other')
    return ' + '.join(sorted(names)) or None


def date_of(v):
    if isinstance(v, (datetime, date)):
        return v.strftime('%Y-%m-%d')
    t = s(v)
    for fmt in ('%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d', '%d.%m.%Y', '%m/%d/%Y'):
        try:
            return datetime.strptime(t, fmt).strftime('%Y-%m-%d')
        except ValueError:
            pass
    return None


def split_university(cell):
    """(visible name or None, text for the encrypted field or None)."""
    t = s(cell)
    if not t:
        return None, None
    if CLEAN_NAME.match(t):
        return t, None
    m = re.match(r"^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'&()]*?)\s*(?::|\s-\s|-\s|\s)\s*(.+)$", t)
    if m and CLEAN_NAME.match(m.group(1).strip()):
        return m.group(1).strip(), t
    return None, t


def label_list(names, palette):
    return [{'name': n, 'color': palette.get(n, '#c4c4c4'), **({'done': True} if n in DONE else {})} for n in names]


DONE = {'Successful', 'Accepted', 'Summary received'}


def options_of(values, first=()):
    seen = list(first)
    for v in values:
        if v and v not in seen:
            seen.append(v)
    return seen


# ------------------------------------------------------------------ register

def board_register(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    items = []
    board_links = []
    groups = [('Sheet1', 'Registered clients', '#579bfc'), ('New Registerd', 'New registrations', '#00c875')]
    for tab, group, _ in groups:
        for n, r in rows_of(wb[tab]):
            name = s(r.get('Full name') or r.get('Full Name'))
            vals, notes, secrets = {}, [], {}
            link = s(r.get('link to application board'))
            if not name and link and all(k == 'link to application board' or v in (None, '', False) for k, v in r.items()):
                board_links.append(link)
                continue
            if not name:
                name = f'Unnamed (row {n} of {tab})'
            if (p := phone(r.get('Contact'))):
                vals['contact'] = p
            if (d := destination(r.get('Destination') or r.get('Destnation'))):
                vals['destination'] = d
            if (sv := canon(r.get('Service'), [(r'full\s*service', 'Full service'), (r'doc\w*\s*arr\w*', 'Document arrangement'), (r'acceptance\s*summary', 'Acceptance + summary')])):
                vals['service'] = sv
            if (ty := canon(r.get('Type'), [(r'student\s*visa', 'Student visa'), (r'visit\w*\s*v\w*|visitor\s*visa', 'Visit visa'), (r'invitation', 'Invitation')])):
                vals['visa'] = ty
            pre, pre_note = money(r.get('prepayment') or r.get('Prepayment'))
            if pre is not None:
                vals['prepayment'] = pre
            if pre_note:
                notes.append(f'Prepayment: {pre_note}')
            fee, fee_note = money(r.get('Payment'))
            if fee is not None:
                vals['fee'] = fee
            if fee_note:
                notes.append(f'Payment: {fee_note}')
            if (st := canon(r.get('Status'), [(r'regist\w*', 'Registered'), (r'succ\w*', 'Successful')])):
                vals['status'] = st
            ag = canon(r.get('Agremment Type') or r.get('Agreement type'), [(r'document', 'Document'), (r'prep\w*', 'Prepayment'), (r'f\w?a\w?l\w?e?s', 'No agreement')])
            if ag:
                vals['agreement'] = ag
            if (it := s(r.get('Intake'))):
                vals['intake'] = it.title()
            link = s(r.get('link to application board'))
            if link.lower().startswith('http'):
                vals['board_link'] = link
            elif link:
                secrets['other'] = link
            if (a := s(r.get('Agent'))):
                vals['agent'] = {'name': a}
            if notes:
                vals['notes'] = '\n'.join(notes)
            items.append({'group': group, 'name': name, 'vals': vals, 'secrets': secrets})

    dests = options_of(sorted({i['vals'].get('destination') for i in items} - {None}))
    report.append(f'register: {len(items)} clients')
    return {
        'name': 'Client register',
        'description': 'Every registered client: service, agreement and payments. Imported from the office register sheet.'
        + (f' Previous application board: {board_links[0]}' if board_links else ''),
        'source': f"Google Sheet {SOURCES['register']}",
        'settings': {'assign_column': 'agent', 'kanban_column': 'status'},
        'columns': [
            {'k': 'status', 'name': 'Status', 'type': 'status', 'settings': {'labels': label_list(['Registered', 'In progress', 'Successful', 'Cancelled'], {'Registered': '#579bfc', 'In progress': '#fdab3d', 'Successful': '#00c875', 'Cancelled': '#e2445c'})}},
            {'k': 'agent', 'name': 'Agent', 'type': 'person'},
            {'k': 'contact', 'name': 'Phone', 'type': 'phone'},
            {'k': 'destination', 'name': 'Destination', 'type': 'dropdown', 'settings': {'options': dests}},
            {'k': 'visa', 'name': 'Visa type', 'type': 'dropdown', 'settings': {'options': ['Student visa', 'Visit visa', 'Work visa', 'Invitation']}},
            {'k': 'service', 'name': 'Service', 'type': 'dropdown', 'settings': {'options': ['Full service', 'Document arrangement', 'Acceptance + summary']}},
            {'k': 'agreement', 'name': 'Agreement', 'type': 'dropdown', 'settings': {'options': ['Document', 'Prepayment', 'No agreement']}},
            {'k': 'intake', 'name': 'Intake', 'type': 'dropdown', 'settings': {'options': ['September', 'March']}},
            {'k': 'prepayment', 'name': 'Prepayment', 'type': 'money', 'settings': {'currency': 'ETB'}},
            {'k': 'fee', 'name': 'Total fee', 'type': 'money', 'settings': {'currency': 'ETB'}},
            {'k': 'board_link', 'name': 'Application board', 'type': 'link'},
            {'k': 'other', 'name': 'Other credentials', 'type': 'secret'},
            {'k': 'notes', 'name': 'Notes', 'type': 'longtext'},
        ],
        'groups': [{'name': g, 'color': c} for _, g, c in groups],
        'items': items,
    }


# ------------------------------------------------------------------ university applications

APP_LABELS = ['Application started', 'In progress', 'Applied', 'Accepted', 'Payment', 'On hold / terminated']
APP_COLORS = {'Application started': '#c4c4c4', 'In progress': '#fdab3d', 'Applied': '#579bfc', 'Accepted': '#00c875', 'Payment': '#a25ddc', 'On hold / terminated': '#e2445c'}


def app_status(v):
    t = s(v).lower()
    if not t:
        return None
    if 'terminat' in t or 'hold' in t:
        return 'On hold / terminated'
    if 'accept' in t:
        return 'Accepted'
    if 'payment' in t:
        return 'Payment'
    if 'applied' in t:
        return 'Applied'
    if 'progress' in t:
        return 'In progress'
    if 'start' in t:
        return 'Application started'
    return None


def board_applications(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    items = []
    tabs = [('202526', 'Intake 2025/26', '#579bfc'), ('20267', 'Intake 2026/27', '#00c875')]
    for tab, group, _ in tabs:
        for n, r in rows_of(wb[tab]):
            g = lambda *keys: next((r[k] for k in keys if r.get(k) not in (None, '', False)), None)
            name = s(g('Full name', 'Name'))
            vals, secrets, notes = {}, {}, []
            if not name:
                name = f'Unnamed (row {n} of {tab})'
            if (d := s(g('Department and Interest', 'Department'))):
                vals['department'] = d
            em = s(g('Application Email', 'email'))
            if em and EMAIL.match(em):
                vals['app_email'] = em.lower()
            elif em:
                secrets['app_password'] = f'Email cell: {em}'
            pw = s(g('Password', 'pass'))
            if pw:
                secrets['app_password'] = (secrets.get('app_password', '') + '\n' + pw).strip()
            if (dest := destination(g('Denstination', 'Italy, Austria'))):
                vals['destination'] = dest
            if (st := app_status(g('Status', 'Column 1'))):
                vals['status'] = st
            paid = s(g('Column 2'))
            if paid:
                vals['fee_paid'] = 'Paid' if paid.lower() == 'paid' else 'Not paid'
            acc = s(g('Accepting University'))
            univ = r.get('UNIV')
            if not acc and univ not in (None, '', False, 'False'):
                acc = s(univ)
            if acc:
                vals['accepted_at'] = acc.title() if acc.isupper() else acc
            if (a := s(g('Agent'))):
                vals['agent'] = {'name': a}
            if r.get('Pre-enroled') is True:
                vals['pre_enrolled'] = True
            if (pe := s(g('Pre enrolment'))):
                notes.append(f'Pre-enrolment: {pe}')
            for i, keys in ((1, ('University 1',)), (2, ('University 2',)), (3, ('University 3', 'Univerity 3'))):
                visible, hidden = split_university(g(*keys))
                if visible:
                    vals[f'uni{i}'] = visible
                if hidden:
                    secrets[f'uni{i}_login'] = hidden
            tax = s(g('TAX CODE', 'Column 8'))
            if tax and TAX_CODE.match(tax.upper()):
                vals['tax_code'] = tax.upper()
            elif tax:
                secrets['other'] = (secrets.get('other', '') + '\n' + tax).strip()
            emb = g('EMBASSY APPOINTMENT DATE')
            if emb:
                if (dt := date_of(emb)):
                    vals['embassy_date'] = dt
                else:
                    notes.append(f'Embassy appointment: {s(emb)}')
            if (c4 := s(g('Column 4'))) and CLEAN_NAME.match(c4):
                notes.append(c4)
            if (c5 := s(g('Column 5'))):
                secrets['other'] = (secrets.get('other', '') + '\n' + c5).strip()
            if notes:
                vals['notes'] = '\n'.join(notes)
            items.append({'group': group, 'name': name, 'vals': vals, 'secrets': secrets})

    dests = options_of(sorted({i['vals'].get('destination') for i in items} - {None}))
    report.append(f'applications: {len(items)} clients')
    return {
        'name': 'University applications',
        'description': 'Admission applications by intake: universities, status, portal logins and pre-enrolment. Imported from the applications sheet.',
        'source': f"Google Sheet {SOURCES['applications']}",
        'settings': {'assign_column': 'agent', 'kanban_column': 'status'},
        'columns': [
            {'k': 'status', 'name': 'Status', 'type': 'status', 'settings': {'labels': label_list(APP_LABELS, APP_COLORS)}},
            {'k': 'agent', 'name': 'Agent', 'type': 'person'},
            {'k': 'destination', 'name': 'Destination', 'type': 'dropdown', 'settings': {'options': dests}},
            {'k': 'department', 'name': 'Department / interest', 'type': 'text'},
            {'k': 'uni1', 'name': 'University 1', 'type': 'text'},
            {'k': 'uni1_login', 'name': 'University 1 login', 'type': 'secret'},
            {'k': 'uni2', 'name': 'University 2', 'type': 'text'},
            {'k': 'uni2_login', 'name': 'University 2 login', 'type': 'secret'},
            {'k': 'uni3', 'name': 'University 3', 'type': 'text'},
            {'k': 'uni3_login', 'name': 'University 3 login', 'type': 'secret'},
            {'k': 'accepted_at', 'name': 'Accepting university', 'type': 'text'},
            {'k': 'pre_enrolled', 'name': 'Pre-enrolled', 'type': 'checkbox'},
            {'k': 'fee_paid', 'name': 'University fee', 'type': 'dropdown', 'settings': {'options': ['Paid', 'Not paid']}},
            {'k': 'embassy_date', 'name': 'Embassy appointment', 'type': 'date'},
            {'k': 'app_email', 'name': 'Application email', 'type': 'email'},
            {'k': 'app_password', 'name': 'Application email password', 'type': 'secret'},
            {'k': 'tax_code', 'name': 'Italian tax code', 'type': 'text'},
            {'k': 'other', 'name': 'Other credentials', 'type': 'secret'},
            {'k': 'notes', 'name': 'Notes', 'type': 'longtext'},
        ],
        'groups': [{'name': g, 'color': c} for _, g, c in reversed(tabs)],  # the newest intake first
        'items': items,
    }


# ------------------------------------------------------------------ Italy pre-enrolment

def board_italy(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    items = []
    for n, r in rows_of(wb['Sheet1']):
        name = s(r.get('Full name')) or f'Unnamed (row {n})'
        vals, secrets = {}, {}
        tax = s(r.get('Italian Tax code'))
        if tax and TAX_CODE.match(tax.upper()):
            vals['tax_code'] = tax.upper()
        elif tax:
            secrets['other'] = tax
        uni = s(r.get('univers Italy'))
        if uni and EMAIL.match(uni):
            vals['universitaly'] = uni.lower()
        elif uni:
            secrets['other'] = (secrets.get('other', '') + '\n' + uni).strip()
        if (pw := s(r.get('password'))):
            secrets['universitaly_password'] = pw
        su = r.get('scholarship user name')
        if isinstance(su, str) and su.strip():
            secrets['scholarship_login'] = su.strip()
        if (sp := s(r.get('Password'))):
            secrets['scholarship_login'] = (secrets.get('scholarship_login', '') + '\n' + sp).strip()
        filled = r.get('Summary filled') is True
        received = r.get('Summary Recived') is True
        vals['summary_filled'] = filled
        vals['summary_received'] = received
        vals['status'] = 'Summary received' if received else 'Summary filled' if filled else 'Not started'
        if (extra := s(r.get('additional applcation'))):
            vals['additional'] = canon(extra, [(r'uni\w*\s*bari', 'Uni Bari'), (r'cass?ino', 'Cassino'), (r'upo', 'UPO'), (r'perugia', 'Perugia')])
        items.append({'group': 'Pre-enrolment', 'name': name, 'vals': vals, 'secrets': secrets})

    report.append(f'italy: {len(items)} clients')
    return {
        'name': 'Italy pre-enrolment',
        'description': 'Universitaly pre-enrolment, tax codes and the DOV summary. Imported from the Italy sheet.',
        'source': f"Google Sheet {SOURCES['italy']}",
        'settings': {'assign_column': 'agent', 'kanban_column': 'status'},
        'columns': [
            {'k': 'status', 'name': 'Summary', 'type': 'status', 'settings': {'labels': label_list(['Not started', 'Summary filled', 'Summary received'], {'Not started': '#c4c4c4', 'Summary filled': '#fdab3d', 'Summary received': '#00c875'})}},
            {'k': 'agent', 'name': 'Agent', 'type': 'person'},
            {'k': 'tax_code', 'name': 'Italian tax code', 'type': 'text'},
            {'k': 'universitaly', 'name': 'Universitaly account', 'type': 'email'},
            {'k': 'universitaly_password', 'name': 'Universitaly password', 'type': 'secret'},
            {'k': 'scholarship_login', 'name': 'Scholarship login', 'type': 'secret'},
            {'k': 'summary_filled', 'name': 'Summary filled', 'type': 'checkbox'},
            {'k': 'summary_received', 'name': 'Summary received', 'type': 'checkbox'},
            {'k': 'additional', 'name': 'Additional application', 'type': 'text'},
            {'k': 'other', 'name': 'Other credentials', 'type': 'secret'},
            {'k': 'notes', 'name': 'Notes', 'type': 'longtext'},
        ],
        'groups': [{'name': 'Pre-enrolment', 'color': '#a25ddc'}],
        'items': items,
    }


def main():
    folder, out = Path(sys.argv[1]), Path(sys.argv[2])
    spec = [
        board_register(folder / f"{SOURCES['register']}.xlsx"),
        board_applications(folder / f"{SOURCES['applications']}.xlsx"),
        board_italy(folder / f"{SOURCES['italy']}.xlsx"),
    ]
    out.write_text(json.dumps(spec, ensure_ascii=False, indent=1), encoding='utf-8')
    for line in report:
        print(line)
    # a check that no visible value looks like a password: long, mixed, with symbols
    risky = 0
    for b in spec:
        visible = {c['k'] for c in b['columns'] if c['type'] != 'secret'}
        for i in b['items']:
            for k, v in i['vals'].items():
                if k in visible and isinstance(v, str) and re.search(r'[!@#$%^*]', v) and not EMAIL.match(v):
                    risky += 1
                    print(f'  check: {b["name"]} / {i["name"]} / {k} has symbols — review')
    print('visible values that look like passwords:', risky)


if __name__ == '__main__':
    main()
