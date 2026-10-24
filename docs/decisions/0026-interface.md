# 0026: A bar on top, and a home page that shows what there is

Date: 2026-10-24

Replaces [0018](0018-interface.md).

## Context

0018 took Beszel's simplicity as its measure. What came of it still felt
crowded: a sidebar with a tree, home as a fixed column of tables that said
"no hosts yet" when there were none, a path such as `acme/shop/prod` in
every row, and frames inside frames. Beszel stays the measure for how little
a page shows, but lotse must not look like it: it watches customers, their
checks from outside and their alerts, which Beszel does not, and it has a
look of its own.

## Decision

- **A bar on top instead of a sidebar.** The logo, a switch for whose things
  one looks at (all customers, one customer, or a project or environment of
  it), search, the alerts, the settings, adding something, and the user.
  A customer's page is home for that customer.
- **Home shows what there is.** On top always how things stand, in one
  sentence, and below it only the problems there are. With more than one
  customer, a tile per customer with how it stands and its last 30 days.
  Hosts and checks share one panel with a switch, which shows only what
  exists: without hosts it is just "Checks". A new hub shows the two ways
  to begin, a machine or a check, and nothing else.
- **One line per object.** A row names the customer and project, not the
  path; the environment is on the object's page.
- **Little framing.** The page lies on a grey ground; what holds content
  lies on it in white, with a fine border and rounded corners. No frames
  inside frames.
- **lotse's own look.** Fira Sans and Fira Mono, the logo, indigo for the
  main action, light by default and following the system. Status colors
  mean only state, each with a shape. Nothing is taken from Beszel: no
  code, icons, texts or colors.
- What 0018 said about object pages, the bell, words instead of keys, and
  type and color still holds.

## Consequences

The tree of customers, projects and environments is no longer always in
view; the switch and search lead there. New features find their place in
the bar, on home only when there is something to show, or on an object's
page.
