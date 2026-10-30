const testUrl = process.env.TEST_DATABASE_URL ?? "";
if (!testUrl) {
    throw new Error(
        "Set TEST_DATABASE_URL to a MySQL database before running tests.",
    );
}
process.env.DATABASE_URL = testUrl;
