import { Link } from 'react-router-dom';
import type { Recipe } from '../lib/types';
import { formatDuration } from '../lib/time';
import { StorageImage } from './StorageImage';

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const hero = recipe.images[0];
  const time = formatDuration((recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0) || recipe.totalMinutes);
  return (
    <Link to={'/recipes/' + recipe.id} className="card">
      <div className="card-media">
        {hero ? <StorageImage path={hero.path} alt="" /> : <span className="card-initial" aria-hidden="true">{(recipe.categoryName || recipe.title).charAt(0).toUpperCase()}</span>}
      </div>
      <div className="card-body">
        <h2 className="card-title">{recipe.title}</h2>
        <div className="card-meta">
          {[recipe.author, recipe.categoryName].filter(Boolean).join(' · ')}
          {time ? ' · ' + time : ''}
        </div>
        {recipe.tags.length > 0 && (
          <div className="row" style={{ gap: 4 }}>
            {recipe.tags.slice(0, 3).map((t) => <span className="chip" key={t}>{t}</span>)}
          </div>
        )}
      </div>
    </Link>
  );
}
