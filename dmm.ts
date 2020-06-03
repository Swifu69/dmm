import { denoStdLatestVersion, colours } from "./deps.ts"

const decoder = new TextDecoder()

export interface Module {
    std: boolean;
    name: string;
    version: string,
    url: string,
    repo?: string,
    latestRelease?: string,
    updated?: boolean
}

export const helpMessage: string = "\n" +
    "A module manager for Deno." +
    "\n" +
    "\n" +
    "USAGE:" +
    "\n" +
    "    deno run --allow-read --allow-net [--allow-write] https://github.com/ebebbington/dmm/mod.ts [ARGS] [MODULES]" +
    "\n" +
    "\n" +
    "ARGUMENTS:" +
    "\n" +
    "The check and update arguments cannot be used together." +
    "\n" +
    "\n" +
    "    check" +
    "\n" +
    "        Checks the specified modules for newer version. Will check all if modules are omitted." +
    "\n" +
    "\n" +
    "    update" +
    "\n" +
    "        Updates the specified modules to the newest version. Will update all if modules are omitted." +
    "\n" +
    "\n" +
    "     info" +
    "\n" +
    "        Shows information about the given module." +
    "\n" +
    "\n" +
    "EXAMPLE USAGE:" +
    "\n" +
    "    Assume you are importing an out of date version of `fs` from `std`." +
    "\n" +
    "    deno run --allow-net --allow-read https://github.com/ebebbington/dmm/mod.ts check fs" +
    "\n" +
    "    deno run --allow-net --allow-read --allow-write https://github.com/ebebbington/dmm/mod.ts update fs" +
    "\n"

/**
 * @description
 * Reads the users `deps.ts` file, and all of the imports (or export { ... } from "..."), to construct
 * a list of module objects. It is dynamic to account for the different purposes eg if the user wants all,
 * many, or one module updated/checked
 *
 * @param {string[]} modulesForPurpose. A list the user only wants to check or update. Empty if they want every dep checked or updated
 * @param {string} purpose The users purpose, whether that be "check" or "update". Used for logging
 *
 * @returns {Module[]} The modules we need to check or update
 */
export function getModulesFromDepsFile (modulesForPurpose: string[], purpose: string): Module[] {
    // Get file content and covert each line into an item in an array
    console.info('Reading deps.ts...')
    const usersWorkingDir: string = Deno.cwd()
    const depsContent: string = decoder.decode(Deno.readFileSync(usersWorkingDir + "/deps.ts")); // no need for a try/catch. The user needs a deps.ts file
    let modules: Array<Module> = []
    let listOfDeps: string[] = depsContent.split('\n')
    listOfDeps = listOfDeps.filter(dep => dep !== "") // strip empty lines
    // Collate data for each module imported
    listOfDeps.forEach(dep => {
        // ignore lines that aren't importing from somewhere
        if (dep.indexOf('from \"https://deno.land/') === -1) {
            return
        }
        // Grab data
        const std: boolean = dep.indexOf("https://deno.land/std") >= 0
        const url: string = dep.substring(
            dep.lastIndexOf("from \"") + 6,
            dep.lastIndexOf("\"")
        )
        const version: string = std === true
            ? (dep.split('/std@')[1]).split('/')[0]
            : dep.substring(
                dep.lastIndexOf("@") + 1,
                dep.lastIndexOf("/mod.ts")
            )
        const name: string = std === true
            ? (dep.split('@' + version + '/')[1]).split('/')[0]
            : dep.substring(
                dep.lastIndexOf("/x/") + 3,
                dep.lastIndexOf("@")
            )

        // Only add to `modules` if user wants to check/update all or if it matches one they want to it to
        if (modulesForPurpose.length && modulesForPurpose.indexOf(name) >= 0) {
            modules.push({std, name, version, url})
            console.info('Added ' + name + " into the list to " + purpose)
        } else if (modulesForPurpose.length === 0) {
            modules.push({std, name, version, url})
            console.info('Added ' + name + " into the list to " + purpose)
        }
    })
    return modules
}

/**
 * @description
 * Grabs deno's database.json file and checks all the module names against their git repository
 *
 * @param {Module[]} modules
 *
 * @return {Module[]} The same passed in parameter but with a new `repo` property
 */
export async function addGitHubUrlForModules (modules: Module[]): Promise<Module[]> {
    const res = await fetch("https://raw.githubusercontent.com/denoland/deno_website2/master/database.json")
    const denoDatabase = await res.json()
    modules.forEach(module => {
        if (module.std === false) {
            // 3rd party
            module.repo = "https://github.com/" + denoDatabase[module.name].owner + "/" + denoDatabase[module.name].repo
        } else {
            // std
            module.repo = "https://github.com/denoland/deno/std/" + module.name
        }
    })
    return modules
}

/**
 * @description
 * Appends the latest releast for each module using their repo url
 *
 * @param {Module[]} modules
 *
 * @returns {Promise<Module[]>}
 */
export async function addLatestReleaseForModules (modules: Module[]): Promise<Module[]> {
    for (const module of modules) {
        // if 3rd party, go to the github repo
        if (module.std === false) {
            const res = await fetch(module.repo + "/releases/latest");
            const splitUrl: string[] = res.url.split('/');
            const latestVersion: string = splitUrl[splitUrl.length - 1];
            module.latestRelease = latestVersion;
        } else {
            // when std, get it from somewhere else
            module.latestRelease = denoStdLatestVersion
        }
    }
    return modules
}

/**
 * Main logic for purposes of this module.
 */
export const purposes: { [key: string]: Function } = {
    'check': function (modules: Module[]) {
        console.info('Comparing versions...')
        let depsCanBeUpdated: boolean = false
        let listOfModuleNamesToBeUpdated: string[] = []
        modules.forEach(module => {
            if (module.version !== module.latestRelease) {
                depsCanBeUpdated = true
                listOfModuleNamesToBeUpdated.push(module.name)
                console.log(colours.yellow(module.name + ' can be updated from ' + module.version + ' to ' + module.latestRelease))
            }
        })
        // Logging purposes
        if (depsCanBeUpdated) {
            console.info('To update, run: \n    deno run --allow-net --allow-read --allow-write https://github.com/ebebbington/dmm/mod.ts update ' + listOfModuleNamesToBeUpdated.join(" "))
        } else {
            console.info(colours.green('Your dependencies are up to date'))
        }
    },
    'update': function (modules: Module[]) {
        console.info('Updating...')
        // Read deps.ts and update the string
        const usersWorkingDir: string = Deno.cwd()
        let depsContent: string = decoder.decode(Deno.readFileSync(usersWorkingDir + "/deps.ts")); // no need for a try/catch. The user needs a deps.ts file
        modules.forEach(module => {
            if (module.std === true) {
                // only re-write modules that need to be updated
                if (module.version === denoStdLatestVersion) {
                    return
                }
                depsContent = depsContent.replace("std@" + module.version + '/' + module.name, 'std@' + denoStdLatestVersion + "/" + module.name)
                module.updated = true
            } else {
                // only re-write modules that need to be updated
                if (module.version === module.latestRelease) {
                    return
                }
                depsContent = depsContent.replace(module.name + "@" + module.version, module.name + "@" + module.latestRelease)
                module.updated = true
            }
        })
        // Re-write the file
        Deno.writeFileSync(usersWorkingDir + "/deps.ts", new TextEncoder().encode(depsContent))
        // Below is just for logging
        modules.forEach(module => {
            if (module.std === true && module.updated === true) {
                console.info(colours.green(module.name + ' was updated from ' + module.version + ' to ' + denoStdLatestVersion))
            } else if (module.std === false && module.updated === true) {
                console.info(colours.green(module.name + ' was updated from ' + module.version + ' to ' + module.latestRelease))
            }
        })
        // And if none were updated, add some more logging
        const depsWereUpdated: boolean = (modules.filter(module => module.updated === true)).length >= 1
        if (!depsWereUpdated) {
            console.info(colours.green('Everything is already up to date'))
        }
    }
}