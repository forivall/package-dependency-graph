import * as fs from 'fs'
import * as util from 'util'
import * as path from 'path'
import glob from 'glob'

const readFileAsync = util.promisify(fs.readFile)
const readdirAsync = util.promisify(fs.readdir)
const globAsync = util.promisify(glob);

/**
 * @public
 */
export async function collectDependencies(targetPath: string, excludeNodeModules = false) {
  let packages: string[] | undefined
  let pkg: any = {}
  try {
    pkg = JSON.parse(await readFileAsync(path.resolve(targetPath, 'package.json'), 'utf8'))
  } catch (err) {}
  if (pkg.workspaces) {
    const globs = ([] as string[]).concat(
      pkg.workspaces.packages || "packages/*"
    )
    packages = [
      ...new Set(
        ([] as string[]).concat(
          ...(await Promise.all(globs.map(g => globAsync(g))))
        )
      )
    ]
  }
  if (!packages) {
    const dirPath = path.resolve(targetPath, 'packages')
    packages = (await readdirAsync(dirPath)).map((packageName) => path.resolve(targetPath, 'packages', packageName))
  }
  const dependencies: { [name: string]: string[] } = {}
  for (const packagePath of packages) {
    const packageStats = await statAsync(packagePath)
    if (packageStats && packageStats.isDirectory()) {
      const packageJsonPath = path.resolve(packagePath, 'package.json')
      const packageJsonStats = await statAsync(packageJsonPath)
      if (packageJsonStats && packageJsonStats.isFile()) {
        const packageJsonBuffer = await readFileAsync(packageJsonPath)
        const packageJson: {
          name: string
          dependencies: { [name: string]: string }
        } = JSON.parse(packageJsonBuffer.toString())
        if (packageJson.dependencies) {
          dependencies[packageJson.name] = Object.keys(packageJson.dependencies)
        } else {
          dependencies[packageJson.name] = []
        }
      }
    }
  }
  if (excludeNodeModules) {
    const validPackageNames = new Set(Object.keys(dependencies))
    for (const dependency in dependencies) {
      dependencies[dependency] = dependencies[dependency].filter((d) => validPackageNames.has(d))
    }
  }
  return dependencies
}

function statAsync(p: string) {
  return new Promise<fs.Stats | undefined>((resolve) => {
    fs.stat(p, (err, stats) => {
      if (err) {
        resolve(undefined)
      } else {
        resolve(stats)
      }
    })
  })
}
