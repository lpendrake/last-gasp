# TableTop Timeline

## Purpose of the app
This app is a tool for GMs, Game Masters, who run tabletop role-playing games.

It's primary purpose is note taking and visualisation of notes.

It achieves this by presenting events the GM writes along a timeline, as well as allowing them to have traditional note
files organised as they desire in folders.
These two forms of structured information are called Notes and Events. Events are on the timeline, notes are in folders.

The part that ties it together is wiki links and the Peek feature. Peeks simply shows a preview of any event or note that
is linked via it's ID, which all entities have and is stable, surviving renames and moves.
It is further enhanced by Auto-Tagging, whereby any link added to an event tags that event with the linked entity,
making them easily filterable on the timeline.

## Guiding Principles

Simplicity, speed of action and speed of access to information, all supported by automation.

### Examples of principles in action

There is a quiet intention to how features are built that aims for allowing speedy resolution of intent. For example,
you don't go through a menu and complex forms to create an event, instead you can click anyone on the timeline and
create an event at that point in time by just typing in the title. (simple and speedy action)

The title itself serves as a note of something significant happening (simple) and the rest can be backfilled.
Link insertion is easy, just type @ and start searching, enter to insert and it auto-fills the link name with the title
of the linked file (simple and speedy action and automation) which is easily overridable.

Wiki links can then be used to quickly Peek at the file, (simple and speedy info), or navigate to it (speedy action).
The timeline presents information on when things happens in a clear and concise manner (simple and speedy info).

All this is complex, but in the end the users data is almost entirely made up of very simple markdown files that we
create and manage on their behalf.

Each entity has a "references" property that tells us which entities reference it and we show this to the user,
allowing bi-direction navigation via wikilinks without needing to manually add links in both entities. (simple, speedy
action and automation)

Hopefully this pattern and these guiding principles continue to be infused throughout the life and development of
TableTop Timeline.
