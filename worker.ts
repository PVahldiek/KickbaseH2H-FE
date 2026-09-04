interface Env {
    ASSETS: Fetcher;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // API an Spring Boot weiterleiten
        if (url.pathname.startsWith('/api/')) {
            const backendUrl = new URL(
                url.pathname + url.search,
                'https://kickbaseh2h-be.onrender.com'
            );

            const backendRequest = new Request(backendUrl, request);

            return fetch(backendRequest);
        }

        // Alles andere: Angular ausliefern
        return env.ASSETS.fetch(request);
    }
};