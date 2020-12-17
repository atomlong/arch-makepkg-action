const core = require('@actions/core');
const exec = require('@actions/exec');
const path = require('path')
const os = require('os')
const shlex = require('shlex');

function slug(str) {
  return str.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}

async function main() {
  try {
	if (process.platform !== 'linux') {
		throw new Error('arch-makepkg-action supports only Linux')
	}
	
	const arch = os.arch();
	const distro = 'archlinux';

	const dockerFile = path.join(__dirname, 'Dockerfile');
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
  
	// Generate a container name slug unique to this workflow
	const containerName = slug([
		'run-on-arch', env.GITHUB_REPOSITORY, env.GITHUB_WORKFLOW,
		arch, distro,
	].join('-'));
  
    await exec.exec(path.join(__dirname, 'scripts/ci-build.sh'), [ dockerFile, containerName, ...dockerRunArgs ], { env }, );

  } catch (error) {
    core.setFailed(error.message);
  }
}

main();
