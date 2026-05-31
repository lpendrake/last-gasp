export interface DummyTemplate {
  id: string;
  name: string;
  content: string;
}

export const DUMMY_TEMPLATES: DummyTemplate[] = [
  {
    id: 'session-recap',
    name: 'Session Recap',
    content: `# Session Recap — [Session Number]

**Date played:** [Date]
**Players present:** [Names]

## What happened

- [Main plot beat]
- [Key encounter or decision]
- [NPC interaction]

## Notable moments

[Describe a memorable moment from the session]

## Loose threads

- **[Hook]** — [Brief description]

## XP & rewards

[List experience and loot awarded]
`,
  },
  {
    id: 'npc-profile',
    name: 'NPC Profile',
    content: `# [NPC Name]

**Role:** [Merchant / Guard Captain / Villain / etc.]
**Location:** [Where they are usually found]
**Affiliation:** [Faction or group]

## Appearance

[Brief physical description — 1–2 sentences]

## Personality

[Key traits and mannerisms]

## Motivation

**Wants:** [What they are trying to achieve]
**Fears:** [What they are trying to avoid]

## Relationship to the party

[How they know or feel about the players]

## Notes

- [Rumour or secret they hold]
- [Plot hook attached to this NPC]
`,
  },
  {
    id: 'location',
    name: 'Location',
    content: `# [Location Name]

**Type:** [City / Dungeon / Wilderness / etc.]
**Region:** [Broader area it sits within]

## Description

[Sensory overview — what the party sees, hears, and smells on arrival]

## Key areas

- **[Room / District]** — [One-line summary]
- **[Room / District]** — [One-line summary]

## Inhabitants

[Who or what lives here]

## Hooks & secrets

- [Something the players might discover]
- [Hidden danger or treasure]

## DM notes

[Anything useful for running scenes here]
`,
  },
];
