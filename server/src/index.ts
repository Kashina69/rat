import { createApp } from "./app.js";
import { env } from "./env.js";

const app = createApp();

const server = app.listen(env.port, env.host, () => {
    console.log(
        `Server listening on http://${env.host}:${env.port} (${env.nodeEnv})`,
    );
});

function shutdown(signal: string) {
    console.log(`Received ${signal}, shutting down...`);
    server.close((err) => {
        if (err) {
            console.error(err);
            process.exitCode = 1;
        }
        process.exit();
    });
    setTimeout(() => process.exit(1), 10_000).unref();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => shutdown(signal));
}

process.on("unhandledRejection", (err) => {
    console.error(err);
    shutdown("unhandledRejection");
});
