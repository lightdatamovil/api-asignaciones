export function debugHttpError(err, ctx = "http") {
    const status = err.response?.status;
    const statusText = err.response?.statusText;
    const body = err.response?.data;

    console.error(`[${ctx}] AxiosError ${status ?? "(sin status)"} ${statusText ?? ""}`.trim());
    if (body !== undefined) {
        console.error(`[${ctx}] body:`, typeof body === "string" ? body : JSON.stringify(body));
    }
    console.error(`[${ctx}] message:`, err.message);

}