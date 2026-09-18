import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@docly/ui';

// Placeholder route proving out the (app) route group. Real dashboard content
// arrives with a later feature - this exists to validate routing/layout
// structure, not to be a finished screen.
export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>
            Placeholder route inside the authenticated (app) route group. Real content and
            access control land with the authentication feature.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </main>
  );
}
