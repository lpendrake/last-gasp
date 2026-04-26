# timeline
text is a bit too small. bump it up a few.
That's gonna have a knock on effect on the month name under it and the now label, both of which could use the same size bump.

day labels are centered on the day marker. Have them left aligned instead, 
IE ------|------
          Mon 4th of Desnus
Bonus: add the 3 letter abreviation of the day of the weak into that label.

## card position

![img_1.png](img_1.png)
The min hight above the line that cards can be at needs to move up a bit, it's a bit awkward fitting the mouse between the timeline and the cards right now when making new events.

## new event seeking

hold control while over the timeline to snap to the nearest day

# new event popup
the carret starts in the title, that's good.
Hitting ctrl+enter should save it and close the popup whatever field I have selected (assuming it's valid)
tabbing works
don't need the status field
the colour one should be a dropdown of pre-made colours I think, I don't know hex colours (not a FE dev, sorry)
just give me like 10 of them, if you're feeling adventurous add a custom one and that shows a colour wheel or whatever.

ctrl+enter 

![img.png](img.png)
that red "retry" bar is there from the moment it's opened. It shouldn't be visible until an error occurs.

# event editing

double click on an event body or header opens the editor.

# sessions

two sessions exist that do not show up in the session tracker.
![img_2.png](img_2.png)

## Big change... think it through, write a plan down somewhere.
Those two sessions are so close together their labels overlap and the earlier one is hidden.
This, one day spanning many sessions, is a somewhat common occurance. I've had 1 in game day last 4 sessions.
I think we need to be able to make the space 1 day occupies flexible, not fixed.

|session 1--|s2|s3-----|s4-----|s5--|s6--------------------------| <---- session spans
     [event 2]  [event 4] [event 6]  [event 8]                     <---- events
[event 1]    [event 3]  [event 5] [event 7]              [event 9] <---- events
|--------------|--------------------------|--------|-------------| <---- timeline
day 1          day 2                      day 3    day 4         day 5

Events 1 and 2 are in session 1, event 3 in session 2, event 4 in session 3, event 5 and 6 in session 4, event 7 in session 5 and event 8 and 9 in session 6.
See the chaos we need to adapt to? The days stretching in size is going to be very useful I think, but I'm open to other solutions.


Role: TTRPG Data Auditor and Archivist.
Task: Analyze the campaign files to create a Reconciliation Index. Do not generate files yet.

Go over all the files in ./old-notes
running-notes.md is the master file of campaign notes.

1. Timeline Mapping:
- Start Date: Day 1 = 4726-03-01.
- Step: Identify every "Day X" and "Session X" in 'running-notes.md'.
- Step: real world dates are the markers of when we played IRL, IE the session dates which will need to be put on every event.
- note: events might span several sessions. In this case, split them into separate events, one per session they are in.

2. Entity De-duplication & Slugification:
   Identify all NPCs, Factions, and Locations.
- Step: Group typos (e.g., "Lady So Yun", "soyun") into a single identity.
- Step: Generate a "Slug" for each entity. Slugs must be lowercase, use hyphens instead of spaces, and remove punctuation (e.g., "Lady So Yun" becomes "lady-so-yun").

Output Requirements:
Present a table for NPCs, Locations, and Factions:
- [Original Name(s)] | [Proposed Slug] | [Type] | [Confirmed Identity?]
  Present a "Timeline Index":
- [Session Date] | [In-Game Day #] | [Calculated In-Game Date]

Wait for my confirmation on slugs and identities before proceeding.
