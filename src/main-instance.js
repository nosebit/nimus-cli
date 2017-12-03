import program from "commander";

program
    .command("create", "Create an instance")
    .command("list", "List all instances")
    .command("remove", "Remove an instance")
    .parse(process.argv);