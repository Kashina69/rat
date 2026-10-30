const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
    throw new Error(
        "TEST_DATABASE_URL is required. Point it at a throwaway MySQL database whose name ends with _test, e.g. mysql://dms:dms@localhost:3306/dms_test",
    );
}

process.env.TEST_DATABASE_URL = testDatabaseUrl;
process.env.DATABASE_URL = testDatabaseUrl;
process.env.NODE_ENV = "test";

if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = "test-only-jwt-secret-not-a-real-secret-000000";
}
