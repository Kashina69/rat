const DEADLOCK_CODE = "P2034";

function errorCode(error: unknown): string | null {
    if (typeof error !== "object" || error === null || !("code" in error)) {
        return null;
    }
    const { code } = error as { code?: unknown };
    return typeof code === "string" ? code : null;
}

export function isDeadlock(error: unknown): boolean {
    return errorCode(error) === DEADLOCK_CODE;
}

export async function withDeadlockRetry<T>(run: () => Promise<T>): Promise<T> {
    try {
        return await run();
    } catch (error) {
        if (!isDeadlock(error)) {
            throw error;
        }
        return run();
    }
}
