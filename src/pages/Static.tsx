import { Link } from 'react-router-dom';
import { EmptyState } from '../components/States';

export function About() {
  return (
    <div className="reading">
      <h1>About</h1>
      <p>RecipeLewis is a private cookbook for the Lewis family. Recipes are visible only to invited family members.</p>
      <p>Built by Scott Lewis with AI assistance. Hosted on Firebase.</p>
    </div>
  );
}
export function Legal() {
  return (
    <div className="reading">
      <h1>Legal</h1>
      <p>© Scott Lewis. All rights reserved. Recipes and photos are shared privately among family members and may not be republished.</p>
      <p>Accounts are by invitation only. We store your name, email address, and the recipes and photos you add. We don’t sell or share this information.</p>
    </div>
  );
}
export function NotFound({ message }: { message?: string }) {
  return (
    <div className="reading">
      <EmptyState level={1} title="Page not found">{message ?? 'We couldn’t find that page.'}</EmptyState>
      <p style={{ textAlign: 'center' }}><Link className="btn btn-primary" to="/recipes">Back to recipes</Link></p>
    </div>
  );
}
