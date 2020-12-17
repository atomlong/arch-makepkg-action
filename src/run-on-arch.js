const core = require('@actions/core')
const fs = require('fs');
const path = require('path')
const YAML = require('yaml');
const shlex = require('shlex');
const { exec } = require('@actions/exec')

function slug(str) {
  return str.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}

async function main() {
  if (process.platform !== 'linux') {
    throw new Error('run-on-arch supports only Linux')
  }

  const arch = core.getInput('arch', { required: true });
  const distro = core.getInput('distro', { default: 'archlinuxarm' });

  // If bad arch/distro passed, fail fast before installing all the qemu stuff
  const dockerFile = path.join(
    __dirname, '..', 'Dockerfiles', `Dockerfile.${arch}.${distro}`);
  if (!fs.existsSync(dockerFile)) {
    throw new Error(`run-on-arch: ${dockerFile} does not exist.`);
  }

  // Write setup commands to a script file for sourcing
  let setup = core.getInput('setup');
  fs.writeFileSync(
    path.join(__dirname, 'run-on-arch-setup.sh'),
    setup,
  );

  // If no shell provided, default to sh for alpine, bash for others
  let shell = core.getInput('shell');
  if (!shell) {
    if (/alpine/.test(distro)) {
      shell = '/bin/sh';
    } else {
      shell = '/bin/bash';
    }
  }

  // Write install commands to a script file for running in the Dockerfile
  const install = [
    `#!${shell}`, 'set -eu;', 'export DEBIAN_FRONTEND=noninteractive;',
    core.getInput('install'),
  ].join('\n');
  fs.writeFileSync(
    // Must be in same directory as Dockerfiles
    path.join(__dirname, '..', 'Dockerfiles', 'run-on-arch-install.sh'),
    install,
  );

  // Write container commands to a script file for running
  const commands = [
    `#!${shell}`, 'set -eu;', core.getInput('run'), path.join(__dirname, 'ci-build.sh'),
  ].join('\n');
  fs.writeFileSync(
    path.join(__dirname, 'run-on-arch-commands.sh'),
    commands,
  );

  // Parse dockerRunArgs into an array with shlex
  const dockerRunArgs = shlex.split(core.getInput('dockerRunArgs'));

  const githubToken = core.getInput('githubToken');
  const rcloneConfig = core.getInput('rcloneConfig', { required: true });
  const pgpKey = core.getInput('pgpKey', { required: true });
  const pgpKeyPassword = core.getInput('pgpKeyPassword', { required: true });
  const deployPath = core.getInput('deployPath', { required: true });
  const pacmanRepo = core.getInput('pacmanRepo');
  const customRepos = core.getInput('customRepos');
  
  // Copy environment variables from parent process
  const env = { ...process.env };

  if (githubToken) {
    env.GITHUB_TOKEN = githubToken;
  }
  
  if (rcloneConfig) {
	env['RCLONE_CONF'] = rcloneConfig;
	dockerRunArgs.push(`-eRCLONE_CONF`);
  }
  
  if (pgpKey) {
	env['PGP_KEY'] = pgpKey;
	dockerRunArgs.push(`-ePGP_KEY`);
  }
  
  if (pgpKeyPassword) {
	env['PGP_KEY_PASSWD'] = pgpKeyPassword;
	dockerRunArgs.push(`-ePGP_KEY_PASSWD`);
  }
  
  if (deployPath) {
	env['DEPLOY_PATH'] = deployPath;
	dockerRunArgs.push(`-eDEPLOY_PATH`);
  }
  
  if (pacmanRepo) {
	env['PACMAN_REPO'] = pacmanRepo;
	dockerRunArgs.push(`-ePACMAN_REPO`);
  }
  
  if (customRepos) {
	env['CUSTOM_REPOS'] = customRepos;
	dockerRunArgs.push(`-eCUSTOM_REPOS`);
  }
  
  // default variables
  env['CI_REPO'] = env.GITHUB_REPOSITORY;
  dockerRunArgs.push(`-eCI_REPO`);
  
  env['CI_BUILD_DIR'] = env.GITHUB_WORKSPACE;
  dockerRunArgs.push(`-eCI_BUILD_DIR`);
  
  env['CI_COMMIT'] = env.GITHUB_SHA;
  dockerRunArgs.push(`-eCI_COMMIT`);
  
  env['CI_BRANCH'] = env.GITHUB_REF.replace('refs\/heads\/', '');
  dockerRunArgs.push(`-eCI_BRANCH`);
  
  env['CI_BUILD_NUMBER'] = env.GITHUB_RUN_NUMBER;
  dockerRunArgs.push(`-eCI_BUILD_NUMBER`);

  // Parse YAML and for environment variables.
  // They are imported to the container via passing `-e VARNAME` to
  // docker run.
  const envYAML = core.getInput('env');
  if (envYAML) {
    const mapping = YAML.parse(envYAML)
    if (typeof mapping !== 'object' || mapping instanceof Array) {
      throw new Error(`run-on-arch: env must be a flat mapping of key/value pairs.`);
    }
    Object.entries(mapping).forEach(([key, value]) => {
      if (typeof value === 'object') {
        // Nested YAML is invalid
        throw new Error(`run-on-arch: env ${key} value must be flat.`);
      }
      env[key] = value;
      dockerRunArgs.push(`-e${key}`);
    });
  }

  // Generate a container name slug unique to this workflow
  const containerName = slug([
    'run-on-arch', env.GITHUB_REPOSITORY, env.GITHUB_WORKFLOW,
    arch, distro,
  ].join('-'));

  console.log('Configuring Docker for multi-architecture support')
  await exec(
    path.join(__dirname, 'run-on-arch.sh'),
    [ dockerFile, containerName, ...dockerRunArgs ],
    { env },
  );
}

main().catch(err => {
  core.setFailed(err.message)
})
