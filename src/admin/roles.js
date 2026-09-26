/* The five roles, in the words staff see. What each may do is enforced by the
   server (CAPS in php-api/api/lib.php); this file only names and explains.
   Everyone also has their own mailbox, and reads the shared mailboxes that
   are set up for their role (Team & mailboxes). */
export const ROLES = {
  admin: {
    label: 'Administrator',
    about: 'Everything: every client and password, payments, the website, the team — and can open every mailbox, personal ones included.',
  },
  manager: {
    label: 'Manager',
    about: 'All clients and payments, website messages and the website. Cannot see client passwords or manage the team.',
  },
  agent: {
    label: 'Agent',
    about: 'Only the clients assigned to them, including those clients’ passwords. No payments, website messages or website.',
  },
  frontdesk: {
    label: 'Front desk',
    about: 'Registers new clients and answers website enquiries. No payments or passwords.',
  },
  editor: {
    label: 'Website editor',
    about: 'Edits the website’s text, photos and lists. Does not see clients or website messages.',
  },
}

export const roleLabel = (role) => ROLES[role]?.label || role

export const has = (user, cap) => Boolean(user?.caps?.includes(cap))
