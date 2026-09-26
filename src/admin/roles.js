/* The five roles, in the words staff see. What each may do is enforced by the
   server (CAPS in php-api/api/lib.php); this file only names and explains. */
export const ROLES = {
  admin: {
    label: 'Administrator',
    about: 'Everything: every client, every password, payments, the website, the team and board setup.',
  },
  manager: {
    label: 'Manager',
    about: 'All clients and payments, the mailbox and the website. Cannot see client passwords or manage the team.',
  },
  agent: {
    label: 'Agent',
    about: 'Only the clients assigned to them, including those clients’ passwords. No payments, mailbox or website.',
  },
  frontdesk: {
    label: 'Front desk',
    about: 'Registers new clients and answers website enquiries and the mailbox. No payments or passwords.',
  },
  editor: {
    label: 'Website editor',
    about: 'Edits the website’s text, photos and lists. Does not see clients or messages.',
  },
}

export const roleLabel = (role) => ROLES[role]?.label || role

export const has = (user, cap) => Boolean(user?.caps?.includes(cap))
