import { AppLink } from '../components/AppLink';
import {
  PlayerPage,
  PlayerPageHeader,
  RugbyRoosterPersonality,
} from '../components/player';

export const HomePage = () => (
  <PlayerPage>
    <PlayerPageHeader
      actions={
        <>
          <AppLink
            className="focus-ring rr-button rr-button-primary"
            to="/games"
          >
            Browse games
          </AppLink>
          <AppLink
            className="focus-ring rr-button rr-button-secondary"
            to="/sign-in"
          >
            Sign in
          </AppLink>
        </>
      }
      eyebrow="Standalone rugby prediction game"
      personality={
        <RugbyRoosterPersonality
          lazy={false}
          message="Pick boldly. Crow later."
          mood="confident"
          size="lg"
        />
      }
      subtitle="Pick match outcomes and details for televised rugby fixtures, then see how your call stacks up on the fixture leaderboard. Rugby know-how, not betting slips."
      title="Rugby Rooster"
    />

    <section className="grid gap-4 md:grid-cols-3">
      {[
        [
          'Pick the match',
          'Back the result, score-building moments, cards, first try, and a few sharp rugby details.',
        ],
        [
          'Lose points, not cash',
          'Everyone starts from the same total. Misses become deductions once results are in.',
        ],
        [
          'Chase the table',
          'Fixture leaderboards show who read the game right when provisional or final scores land.',
        ],
      ].map(([title, body]) => (
        <article className="rr-surface rr-surface--raised" key={title}>
          <p className="rr-section-eyebrow">{title}</p>
          <p className="rr-body-copy mt-3">{body}</p>
        </article>
      ))}
    </section>
  </PlayerPage>
);
