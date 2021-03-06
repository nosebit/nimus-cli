#!/usr/bin/env node

import program from "commander";

program
    .command("create", "Create an instance")
    .command("setup", "Setup an instance")
    .command("list", "List all instances")
    .command("run", "Run command or script within instance")
    .command("remove", "Remove an instance")
    .parse(process.argv);