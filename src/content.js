// content.js: the story intro cards and the road guide copy (exact wording).
// The road guide lines are also used as first-time tips during the drive.

/** Story intro cards. `name` is the chosen driver's name ("Shally" or "Brandon"). */
export const storyCards = (name) => [
  `This is ${name}. A college student with big plans, and bipolar I disorder. This drive is ${name}’s journey through one year of their life, squeezed into about 3 minutes.`,
  'Bipolar I is a mood disorder. It involves manic episodes: at least a week of unusually high or irritable mood and energy. Many people also have depressive episodes: at least two weeks of low mood or loss of interest. Between episodes, many people feel like themselves.',
  'Episodes are not everyday ups and downs. They last days to weeks and affect sleep, school, work and relationships.',
  'Many things shape the road: sleep and daily routines (biological), big wins and losses (psychological), and family, friends and stigma (social). Treatment and support make the drive steadier.',
  'Guardrails (top right) show how protected you are. Medication taken every month builds them up. Missed medication and stigma take them away. More guardrails mean smaller mood swings.',
  'There is no winning or losing. Try to keep the needle near the middle, and get to graduation.',
];

/** Index of the guardrails card: it also shows the HUD's guardrail icons. */
export const GUARDRAIL_CARD = 4;

/** Road guide: four groups of cards. `model` = item id drawn in 3D; `visual` = a drawn mood picture. */
export const GUIDE = [
  {
    heading: 'MOOD',
    items: [
      { key: 'meter', visual: 'meter', name: 'Mood meter', line: 'Left is low, right is high. The middle is stable.' },
      { key: 'manic', visual: 'manic', name: 'Manic episode', line: 'Fast, hard to steer, risky shortcuts. It can feel exciting inside, but the costs pile up outside.' },
      { key: 'depressive', visual: 'depressive', name: 'Depressive episode', line: 'Slow, heavy and grey. Changing lanes takes effort. Things you enjoyed lose their shine.' },
    ],
  },
  {
    heading: 'THINGS THAT PUSH YOUR MOOD',
    items: [
      { key: 'allNighter', model: 'allNighter', name: 'Skip the rest stop', line: 'Losing sleep can push mood up toward mania.' },
      { key: 'redEye', model: 'redEye', name: 'Red-eye flight', line: 'Travel across time zones disrupts the body clock.' },
      { key: 'trophy', model: 'trophy', name: 'Trophy', line: 'Even good news, like a big win, can push mood too high.' },
      { key: 'scheduleChaos', model: 'scheduleChaos', name: 'Schedule chaos', line: 'Irregular days can throw mood either way.' },
      { key: 'loss', model: 'loss', name: 'Rock (a loss)', line: 'Losses like a breakup can pull mood down.' },
      { key: 'criticism', model: 'criticism', name: 'Harsh words', line: 'Constant criticism at home is linked to relapse.' },
      { key: 'stigmaBillboard', model: 'stigmaBillboard', name: 'Stigma billboard', line: 'Shame about a diagnosis can lead people to skip treatment. It removes a guardrail.' },
    ],
  },
  {
    heading: 'THINGS THAT HELP',
    items: [
      { key: 'medCheckpoint', model: 'medCheckpoint', name: 'Medication', line: 'Taken every month, it builds guardrails that make swings smaller. It works over time, not instantly.' },
      { key: 'restStop', model: 'restStop', name: 'Rest stop', line: 'Regular sleep brings mood back toward the middle. Press Pull in.' },
      { key: 'routineCheckpoint', model: 'routineCheckpoint', name: 'Routine checkpoint', line: 'Steady daily routines protect your body clock.' },
      { key: 'therapyPit', model: 'therapyPit', name: 'Therapy pit stop', line: 'Therapy helps you spot warning signs early. Press Pull in.' },
      { key: 'familyPit', model: 'familyPit', name: 'Family pit crew', line: 'Support from people who understand makes recovery faster. Press Pull in.' },
    ],
  },
];

/** January practice month: exact lines, one step per item (see systems/practice.js). */
export const PRACTICE = {
  meter: 'Keep the needle in the middle.',
  med: 'Drive through your meds to build guardrails.',
  medOk: 'Medication taken: guardrails build up.',
  allNighter: 'Missing sleep pushes mood up. Steer away!',
  sleepOk: 'Nice. Sleep protects your mood.',
  moodUp: 'See? Mood went up.',
  loss: 'Losses pull mood down. Steer away!',
  lossOk: 'Nice. You kept your mood steady.',
  moodDown: 'See? Mood went down.',
  rest: 'Press Pull in to rest.',
  restOk: 'Rested: mood steadier.',
  stigma: 'Stigma removes guardrails. Take the open lane.',
  stigmaOk: 'Support helps you stay on track.',
  ready: 'You’re ready. Have a good year!',
  skip: 'Skip practice',
};
/** First time each episode starts in a run (shown in a slightly larger bottom box). */
export const EPISODE_INTRO = {
  manic: 'Manic episode: fast, hard to steer, risky choices. Rest and support help.',
  depressive: 'Depressive episode: slow and heavy. Lane changes take effort. Support helps.',
};

/** Guide entry by key (item id or 'manic' / 'depressive'). */
export const guideEntry = (key) => GUIDE.flatMap((g) => g.items).find((i) => i.key === key);
