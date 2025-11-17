const { execSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(__dirname, "dist");
const TEMP = path.join(__dirname, "..", ".gh-pages-temp");

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", cwd: opts.cwd || TEMP });
}

(async () => {
  try {
    const repoUrl = execSync("git config --get remote.origin.url", {
      cwd: ROOT,
      stdio: "pipe",
    })
      .toString()
      .trim();
    if (!repoUrl) throw new Error("Remote origin tidak ditemukan.");

    fs.removeSync(TEMP);
    fs.ensureDirSync(TEMP);
    run("git init");
    run("git checkout -b gh-pages");
    fs.copySync(DIST, TEMP, { overwrite: true });
    run('git config user.name "github-actions"');
    run('git config user.email "actions@github.com"');
    run("git add .");
    run('git commit -m "Deploy"');
    run(`git remote add origin ${repoUrl}`);
    run("git push origin gh-pages --force");
    console.log("Deploy GitHub Pages selesai.");
  } catch (err) {
    console.error("Deploy gagal:", err.message || err);
    process.exitCode = 1;
  } finally {
    fs.removeSync(TEMP);
  }
})();
