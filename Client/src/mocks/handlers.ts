import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('*/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };

    if (body.email === 'test@example.com' && body.password === 'password123') {
      return HttpResponse.json({
        token: 'mock-token',
        user: { id: '1', email: body.email, name: 'Test User' },
      });
    }

    return HttpResponse.json({ message: 'Invalid email or password' }, { status: 401 });
  }),

  http.post('*/logout', () => HttpResponse.json(null, { status: 200 })),
];
