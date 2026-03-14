/* ═══════════════════════════════════════════════
   DEPLOY — GitHub API Integration
   
   Creates a repo, pushes compiled files, and
   enables GitHub Pages. All using the user's
   own PAT — zero server-side code.
   ═══════════════════════════════════════════════ */

window.ArbelDeploy = (function () {
    'use strict';

    var API = 'https://api.github.com';

    /** Helper: call GitHub API */
    function _gh(method, path, token, body) {
        var opts = {
            method: method,
            headers: {
                'Authorization': 'Bearer ' + token,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            }
        };
        if (body) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        return fetch(API + path, opts).then(function (res) {
            if (res.status === 204) return null;
            return res.json().then(function (data) {
                if (!res.ok) {
                    var detail = data.message || 'GitHub API error';
                    if (data.errors && data.errors.length) {
                        detail += ' — ' + data.errors.map(function(e) { return e.message || e.code; }).join(', ');
                    }
                    if (res.status === 401) detail = 'Authentication failed. Please sign in again.';
                    if (res.status === 403) detail = 'Permission denied. Your GitHub account may need the required access.';
                    if (res.status === 422 && detail.indexOf('already exists') !== -1) detail = 'Repository "' + (body && body.name || '') + '" already exists. Choose a different name.';
                    var err = new Error(detail);
                    err.status = res.status;
                    err.data = data;
                    throw err;
                }
                return data;
            });
        });
    }

    /**
     * Deploy a compiled site to a new GitHub repo.
     *
     * Flow:
     *  1. Create repo
     *  2. Create blobs for each file
     *  3. Create a tree with all blobs
     *  4. Create an initial commit
     *  5. Create the main branch ref
     *  6. Enable GitHub Pages
     *
     * @param {Object} opts
     * @param {string} opts.repoName — sanitized repo name
     * @param {string} opts.token — GitHub PAT
     * @param {Object} opts.files — { filepath: content } from compiler
     * @param {string} opts.description — repo description
     * @param {function} opts.onProgress — callback(step, total, message)
     * @returns {Promise<{repoUrl: string, siteUrl: string}>}
     */
    function deploy(opts) {
        var token = opts.token;
        var repoName = opts.repoName;
        var files = opts.files;
        var description = opts.description || 'Built with Arbel Generator';
        var progress = opts.onProgress || function () {};
        var owner;
        var totalSteps = 6;

        // 1. Get authenticated user
        progress(1, totalSteps, 'Authenticating...');

        return _gh('GET', '/user', token)
            .then(function (user) {
                owner = user.login;
                progress(2, totalSteps, 'Creating repository...');

                // 2. Create the repo
                return _gh('POST', '/user/repos', token, {
                    name: repoName,
                    description: description,
                    homepage: 'https://' + owner + '.github.io/' + repoName,
                    private: false,
                    auto_init: false,
                    has_issues: false,
                    has_projects: false,
                    has_wiki: false
                });
            })
            .then(function () {
                progress(3, totalSteps, 'Uploading files...');

                // 3. Create blobs for each file
                var filePaths = Object.keys(files);
                var blobPromises = filePaths.map(function (path) {
                    return _gh('POST', '/repos/' + owner + '/' + repoName + '/git/blobs', token, {
                        content: files[path],
                        encoding: 'utf-8'
                    }).then(function (blob) {
                        return { path: path, sha: blob.sha };
                    });
                });

                return Promise.all(blobPromises);
            })
            .then(function (blobs) {
                progress(4, totalSteps, 'Building file tree...');

                // 4. Create tree
                var treeItems = blobs.map(function (b) {
                    return {
                        path: b.path,
                        mode: '100644',
                        type: 'blob',
                        sha: b.sha
                    };
                });

                return _gh('POST', '/repos/' + owner + '/' + repoName + '/git/trees', token, {
                    tree: treeItems
                });
            })
            .then(function (tree) {
                progress(5, totalSteps, 'Creating commit...');

                // 5. Create commit
                return _gh('POST', '/repos/' + owner + '/' + repoName + '/git/commits', token, {
                    message: 'Initial site — generated by Arbel',
                    tree: tree.sha
                });
            })
            .then(function (commit) {
                // 6. Create main branch ref
                return _gh('POST', '/repos/' + owner + '/' + repoName + '/git/refs', token, {
                    ref: 'refs/heads/main',
                    sha: commit.sha
                });
            })
            .then(function () {
                progress(6, totalSteps, 'Enabling GitHub Pages...');

                // 7. Enable GitHub Pages on the main branch
                return _gh('POST', '/repos/' + owner + '/' + repoName + '/pages', token, {
                    build_type: 'legacy',
                    source: {
                        branch: 'main',
                        path: '/'
                    }
                }).catch(function (err) {
                    // Pages enablement can fail if repo is too new; we'll still return success
                    console.warn('Pages activation note:', err.message);
                    return null;
                });
            })
            .then(function () {
                var repoUrl = 'https://github.com/' + owner + '/' + repoName;
                var siteUrl = 'https://' + owner + '.github.io/' + repoName;

                return {
                    repoUrl: repoUrl,
                    siteUrl: siteUrl,
                    owner: owner,
                    repo: repoName
                };
            });
    }

    /**
     * Update an existing repo with new files (for re-deployment).
     * Uses the update-file API for each file.
     */
    function update(opts) {
        var token = opts.token;
        var owner = opts.owner;
        var repoName = opts.repoName;
        var files = opts.files;
        var progress = opts.onProgress || function () {};
        var filePaths = Object.keys(files);
        var completed = 0;

        progress(0, filePaths.length, 'Updating files...');

        // Get current main branch SHA
        return _gh('GET', '/repos/' + owner + '/' + repoName + '/git/ref/heads/main', token)
            .then(function (ref) {
                var latestSha = ref.object.sha;

                // Get the current tree
                return _gh('GET', '/repos/' + owner + '/' + repoName + '/git/commits/' + latestSha, token);
            })
            .then(function (commit) {
                // Create new blobs
                var blobPromises = filePaths.map(function (path) {
                    return _gh('POST', '/repos/' + owner + '/' + repoName + '/git/blobs', token, {
                        content: files[path],
                        encoding: 'utf-8'
                    }).then(function (blob) {
                        completed++;
                        progress(completed, filePaths.length + 2, 'Uploading: ' + path);
                        return { path: path, sha: blob.sha };
                    });
                });

                return Promise.all(blobPromises).then(function (blobs) {
                    return { blobs: blobs, parentSha: commit.sha, treeSha: commit.tree.sha };
                });
            })
            .then(function (data) {
                // Create new tree based on current tree
                var treeItems = data.blobs.map(function (b) {
                    return { path: b.path, mode: '100644', type: 'blob', sha: b.sha };
                });

                return _gh('POST', '/repos/' + owner + '/' + repoName + '/git/trees', token, {
                    base_tree: data.treeSha,
                    tree: treeItems
                }).then(function (tree) {
                    return { treeSha: tree.sha, parentSha: data.parentSha };
                });
            })
            .then(function (data) {
                // Create new commit
                return _gh('POST', '/repos/' + owner + '/' + repoName + '/git/commits', token, {
                    message: 'Update site — Arbel Generator',
                    tree: data.treeSha,
                    parents: [data.parentSha]
                });
            })
            .then(function (commit) {
                // Update main branch ref
                return _gh('PATCH', '/repos/' + owner + '/' + repoName + '/git/refs/heads/main', token, {
                    sha: commit.sha
                });
            })
            .then(function () {
                progress(filePaths.length + 2, filePaths.length + 2, 'Done!');
                return {
                    repoUrl: 'https://github.com/' + owner + '/' + repoName,
                    siteUrl: 'https://' + owner + '.github.io/' + repoName
                };
            });
    }

    /**
     * Check if a repo name is available.
     */
    function checkRepoName(token, repoName) {
        return _gh('GET', '/user', token).then(function (user) {
            return _gh('GET', '/repos/' + user.login + '/' + repoName, token)
                .then(function () { return false; })  // repo exists
                .catch(function (err) {
                    if (err.status === 404) return true;  // available
                    throw err;
                });
        });
    }

    return {
        deploy: deploy,
        update: update,
        checkRepoName: checkRepoName
    };
})();
