# 0027: Things, not hosts and checks

Date: 2026-10-25

Replaces [0026](0026-interface.md).

## Context

0026 put a bar on top and made home show only what exists. It still felt
crushing: every page offered everything at once, tabs for alerts,
notifications, maintenance, settings and activity on each customer and
object, a bell in every row, separate tables and separate ways to add
hosts and checks. Most of the time one only wants to know whether all is
well, and if not, what. A prototype without the existing interface showed
the shape that follows.

## Decision

- **Things.** Whatever lotse watches is a thing in the interface: a server
  with its agent, a website, an API, a port, a certificate, a domain, DNS,
  a cron job. Things are listed alike: how it stands, its name, its kind,
  its last day, and one figure (a server's CPU, memory and disk, a check's
  response, a certificate's days, a cron job's last ping). A server's last
  day is when its agent reported. Hosts and checks stay apart in the API
  and the data.
- **Watching and changing are apart.** Pages show how things stand. What
  can be set, for a customer or a thing, is in a sheet at the side, opened
  by "Settings": who is told, quiet hours, when to tell (switches in plain
  words, the full rules under "Advanced"), and what changed.
- **Home** says in one sentence how everything stands, lists what needs
  attention, then the customers, a line each with its last 30 days; with
  one customer only, its things. A new hub asks what to watch first.
- **A customer's page** lists what needs attention, then everything lotse
  watches for it, under its projects where there is more than one.
- **A thing's page** has no tabs: how it stands, its last 30 days, its
  charts, a server's containers, and what happened.
- **One way to add.** "Add" asks for an address and works out what it is:
  a URL or a name is a website, `host:port` a port. A server and a cron job
  are the two cards beside it; every other kind of check is behind a link
  to its full form. Then: for which customer, and in which group (a
  project). An environment is not asked for: a group's only one is taken,
  or "Production" is made.
- **Environments, on trial.** They stay in the model, but the interface
  names them only where a project has more than one ("Online shop ·
  Staging"). Whether they go further out of sight is decided later.
- **The bar** keeps a short trail: the customer, and the thing whose page
  is open, each with a switch to the others of its kind.
- **Look.** Status is a colored dot without a shape of its own; its word
  is in its title, and where it matters it stands beside it. A big dot,
  beside a page's name, breathes slowly. Days without trouble are a soft
  green; colour is kept for what needs a look. lotse keeps its type, logo
  and indigo, light by default; nothing is taken from Beszel.

## Consequences

New features find their place as a kind of thing, as a figure in its line,
on its page, or in a settings sheet; not as another tab or another table.
