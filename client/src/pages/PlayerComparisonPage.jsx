import React, { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PlayerComparison from '../components/PlayerComparison';

const PlayerComparisonPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const playerIds = useMemo(() => {
    const ids = searchParams.get('ids') || '';
    return ids
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }, [searchParams]);

  if (playerIds.length < 2) {
    return (
      <div className="page-shell page-shell--wide comparison-page-shell">
        <section className="surface-card">
          <div className="page-kicker">Player comparison</div>
          <h1 className="page-title">Choose at least two players.</h1>
          <p className="page-lead">
            Select two or more players from the database to compare them side by side.
          </p>
          <Link className="button button-primary" to="/players">
            Back to players
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--wide comparison-page-shell">
      <PlayerComparison
        variant="page"
        playerIds={playerIds}
        onClose={() => navigate('/players')}
      />
    </div>
  );
};

export default PlayerComparisonPage;
