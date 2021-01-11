import { ConsoleLogger } from "../../deps.ts";
import ModuleService from "../services/module_service.ts";

/**
 * Reads the dependency file(s) and checks if dependencies are out of date
 *     - If `dependencies` passed in, it will only  check those deps inside the dep file
 *     - If `dependencies` is empty, checks all
 *
 * @param dependencies - A list of dependencies (module names) to check
 */
export async function check(dependencies: string[]): Promise<void> {
  // Create objects for each dep, with its name and version
  const allModules = await ModuleService.constructModulesDataFromDeps();
  const selectedModules = allModules.filter((module) => {
    if (dependencies.length) { // only return selected modules of selecting is set
      return dependencies.indexOf(module.name) > -1;
    } else {
      return true;
    }
  });

  if (selectedModules.length === 0) {
    ConsoleLogger.error(
      "Modules specified do not exist in your dependencies.",
    );
    Deno.exit(1);
  }

  // Compare imported and latest version
  ConsoleLogger.info("Comparing versions...");
  let depsCanBeUpdated: boolean = false;
  const listOfModuleNamesToBeUpdated: string[] = [];
  selectedModules.forEach((module) => {
    if (module.importedVersion !== module.latestRelease) {
      depsCanBeUpdated = true;
      listOfModuleNamesToBeUpdated.push(module.name);
      ConsoleLogger.info(
        module.name + " can be updated from " + module.importedVersion +
          " to " + module.latestRelease,
      );
    }
  });
  // Logging purposes
  if (depsCanBeUpdated) {
    ConsoleLogger.info(
      "To update, run: \n    dmm update " +
        listOfModuleNamesToBeUpdated.join(" "),
    );
  } else {
    ConsoleLogger.info("Your dependencies are up to date");
  }
}
