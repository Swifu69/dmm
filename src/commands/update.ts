import { ConsoleLogger, Subcommand } from "../../deps.ts";
import ModuleService from "../services/module_service.ts";

export class UpdateSubcommand extends Subcommand {
  public signature = "update [deps_location] [module]";
  public description =
    "Update all dependencies in the `deps.ts` file in your CWD, or specify certain modules to update or a location to a dependency file.";

  public async handle() {
    const depsLocation = Deno.args.find((arg) => arg.indexOf(".ts") > -1) ??
      "deps.ts";
    const dependencies = Deno.args.filter((arg) =>
      arg.indexOf(".ts") === -1 && arg.indexOf("update") === -1
    ); // Line doesnt allow us to get a n number of args whereby they can be optional
    // Create objects for each dep, with its name and version
    const allModules = await ModuleService.constructModulesDataFromDeps(
      depsLocation,
    );
    const modules = allModules.filter((module) => {
      if (dependencies.length) { // only return selected modules of selecting is set
        return dependencies.indexOf(module.name) > -1;
      } else {
        return true;
      }
    });

    if (modules.length === 0) {
      ConsoleLogger.error(
        "Modules specified do not exist in your dependencies.",
      );
      Deno.exit(1);
    }

    // Check for updates and rewrite `deps.ts` if needed
    ConsoleLogger.info("Checking if your modules can be updated...");
    const usersWorkingDir: string = Deno.realPathSync(".");
    let depsWereUpdated = false;
    let depsContent: string = new TextDecoder().decode(
      Deno.readFileSync(usersWorkingDir + "/" + depsLocation),
    ); // no need for a try/catch. The user needs a deps.ts file

    // Update the file content
    modules.forEach((module) => {
      // only re-write modules that need to be updated
      if (module.importedVersion === module.latestRelease) {
        return;
      }
      if (module.std) {
        depsContent = depsContent.replace(
          "std@" + module.importedVersion + "/" + module.name,
          "std@" + module.latestRelease + "/" + module.name,
        );
      } else {
        let newImportUrl = module.importUrl;
        newImportUrl = newImportUrl.replace(
          module.importedVersion,
          module.latestRelease,
        );
        depsContent = depsContent.replace(module.importUrl, newImportUrl);
      }
      ConsoleLogger.info(
        module.name + " was updated from " + module.importedVersion + " to " +
          module.latestRelease,
      );
      depsWereUpdated = true;
    });

    // Re-write the file
    Deno.writeFileSync(
      usersWorkingDir + "/" + depsLocation,
      new TextEncoder().encode(depsContent),
    );

    // And if none were updated, add some more logging
    if (!depsWereUpdated) {
      ConsoleLogger.info("Everything is already up to date");
    }
  }
}
