/* ═══════════════════════════════════════════════
   DEPLOY — GitHub API Integration
   
   Creates a repo, pushes compiled files, and
   enables GitHub Pages. All using the user's
   own PAT — zero server-side code.
   ═══════════════════════════════════════════════ */

window.ArbelDeploy = (function () {
    'use strict';

    var API = 'https://api.github.com';

    /**
     * Extract large embedded data: URIs from file contents into separate
     * binary files.  GitHub's Contents/blob API rejects payloads roughly
     * over 40 MB ("Sorry, your input was too large to process"), and when
     * users upload a bg video it gets baked into the HTML as a base64
     * data-URI that can easily push a single file past that limit.
     *
     * For every data:(image|video)/...;base64,... occurrence above the
     * threshold we:
     *   1. write a new binary file at assets/embed-{n}.{ext}
     *   2. replace the data-URI in the original text with the relative path
     *   3. emit the binary as a separate files entry with _binary: true
     *
     * Returns { files, binaryFiles } — binaries are uploaded with
     * base64 encoding; text files stay utf-8.
     */
    function _extractLargeEmbeds(files) {
        var THRESHOLD = 512 * 1024; // bytes (data-URI length, not decoded)
        var binaryFiles = {};
        var counter = 0;
        var mimeExt = {
            'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
            'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg',
            'video/mp4': 'mp4', 'video/webm': 'webm', 'video/ogg': 'ogv',
            'video/quicktime': 'mov'
        };
        var out = {};
        Object.keys(files).forEach(function (path) {
            var content = files[path];
            if (typeof content !== 'string' || content.length < THRESHOLD) {
                out[path] = content;
                return;
            }
            // Only rewrite HTML/CSS/JS — never mutate already-binary content
            if (!/\.(html?|css|js|json|svg|xml|txt|md)$/i.test(path)) {
                out[path] = content;
                return;
            }
            var re = /data:([\w+/-]+);base64,([A-Za-z0-9+/=]+)/g;
            content = content.replace(re, function (match, mime, b64) {
                if (match.length < THRESHOLD) return match;
                var ext = mimeExt[mime.toLowerCase()] || 'bin';
                counter++;
                var fname = 'assets/embed-' + counter + '.' + ext;
                binaryFiles[fname] = b64; // already base64
                return fname;
            });
            out[path] = content;
        });
        return { files: out, binaryFiles: binaryFiles };
    }

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

                // 2. Create the repo with auto_init to avoid empty repo issues
                return _gh('POST', '/user/repos', token, {
                    name: repoName,
                    description: description,
                    homepage: 'https://' + owner + '.github.io/' + repoName,
                    private: false,
                    auto_init: true,
                    has_issues: false,
                    has_projects: false,
                    has_wiki: false
                });
            })
            .then(function () {
                // Poll for repo readiness instead of fixed timeout (B15)
                var attempts = 0;
                function waitForRepo() {
                    return _gh('GET', '/repos/' + owner + '/' + repoName + '/git/ref/heads/main', token)
                        .catch(function (err) {
                            if (attempts++ < 10) {
                                return new Promise(function (resolve) { setTimeout(resolve, 1000); }).then(waitForRepo);
                            }
                            throw err;
                        });
                }
                return waitForRepo();
            })
            .then(function (ref) {
                progress(3, totalSteps, 'Uploading files...');

                var parentSha = ref.object.sha;

                // Extract oversized data-URIs into separate binary assets so
                // no single blob exceeds GitHub's 40 MB JSON input limit.
                var split = _extractLargeEmbeds(files);
                var textFiles = split.files;
                var binaryFiles = split.binaryFiles;

                var textBlobs = Object.keys(textFiles).map(function (path) {
                    return _gh('POST', '/repos/' + owner + '/' + repoName + '/git/blobs', token, {
                        content: textFiles[path],
                        encoding: 'utf-8'
                    }).then(function (blob) { return { path: path, sha: blob.sha }; });
                });
                var binBlobs = Object.keys(binaryFiles).map(function (path) {
                    return _gh('POST', '/repos/' + owner + '/' + repoName + '/git/blobs', token, {
                        content: binaryFiles[path],
                        encoding: 'base64'
                    }).then(function (blob) { return { path: path, sha: blob.sha }; });
                });

                return Promise.all(textBlobs.concat(binBlobs)).then(function (blobs) {
                    return { blobs: blobs, parentSha: parentSha };
                });
            })
            .then(function (data) {
                progress(4, totalSteps, 'Building file tree...');

                // 5. Create tree
                var treeItems = data.blobs.map(function (b) {
                    return {
                        path: b.path,
                        mode: '100644',
                        type: 'blob',
                        sha: b.sha
                    };
                });

                return _gh('POST', '/repos/' + owner + '/' + repoName + '/git/trees', token, {
                    tree: treeItems
                }).then(function (tree) {
                    return { treeSha: tree.sha, parentSha: data.parentSha };
                });
            })
            .then(function (data) {
                progress(5, totalSteps, 'Creating commit...');

                // 6. Create commit with parent (the auto_init commit)
                return _gh('POST', '/repos/' + owner + '/' + repoName + '/git/commits', token, {
                    message: 'Initial site — generated by Arbel',
                    tree: data.treeSha,
                    parents: [data.parentSha]
                });
            })
            .then(function (commit) {
                // 7. Update main branch ref to point to our new commit
                return _gh('PATCH', '/repos/' + owner + '/' + repoName + '/git/refs/heads/main', token, {
                    sha: commit.sha,
                    force: true
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
        // Apply the same data-URI extraction the initial deploy uses.
        var split = _extractLargeEmbeds(opts.files);
        var files = split.files;
        var binaryFiles = split.binaryFiles;
        var progress = opts.onProgress || function () {};
        var filePaths = Object.keys(files);
        var binPaths = Object.keys(binaryFiles);
        var totalPaths = filePaths.length + binPaths.length;
        var completed = 0;

        progress(0, totalPaths, 'Updating files...');

        // Get current main branch SHA
        return _gh('GET', '/repos/' + owner + '/' + repoName + '/git/ref/heads/main', token)
            .then(function (ref) {
                var latestSha = ref.object.sha;

                // Get the current tree
                return _gh('GET', '/repos/' + owner + '/' + repoName + '/git/commits/' + latestSha, token);
            })
            .then(function (commit) {
                // Create new blobs — text + extracted binary assets
                var textBlobs = filePaths.map(function (path) {
                    return _gh('POST', '/repos/' + owner + '/' + repoName + '/git/blobs', token, {
                        content: files[path],
                        encoding: 'utf-8'
                    }).then(function (blob) {
                        completed++;
                        progress(completed, totalPaths + 2, 'Uploading: ' + path);
                        return { path: path, sha: blob.sha };
                    });
                });
                var binBlobs = binPaths.map(function (path) {
                    return _gh('POST', '/repos/' + owner + '/' + repoName + '/git/blobs', token, {
                        content: binaryFiles[path],
                        encoding: 'base64'
                    }).then(function (blob) {
                        completed++;
                        progress(completed, totalPaths + 2, 'Uploading: ' + path);
                        return { path: path, sha: blob.sha };
                    });
                });
                var blobPromises = textBlobs.concat(binBlobs);

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
