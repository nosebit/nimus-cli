import program from "commander";

program
    .command("create", "Create a project")
    .command("list", "List all projects")
    .command("remove", "Remove a project")
    .parse(process.argv);