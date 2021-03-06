module.exports = function(grunt) {
    "use strict";

    var path = require("path");
    var fs = require("fs");

    var nunjucks = require("nunjucks");
    nunjucks.configure({watch: false});

    require("load-grunt-tasks")(grunt);

    var pkg = grunt.file.readJSON("package.json");
    pkg.version = grunt.template.today("yy.mm.ddHHMM");

    var backends = {
        web: [
            "build/js/backend/FileReader.js",
            "build/js/backend/GoogleDrive.config.js"
        ],
        nw: [
            "build/js/backend/NodeWebkit.js"
        ]
    };

    var buildConfigJs = grunt.option("buildConfig") || "buildConfig.js";
    var buildConfig = {
        platforms: [
            "win32", "osx32", "linux32",
            "win64", "osx64", "linux64"
        ],
        nwVersion: "0.12.3",
        nwOptions: {
            toolbar: false
        },
        uglifyOptions:{}
    };
    try {
        var customBuildConfig = require(path.resolve(buildConfigJs));
        grunt.verbose.writeln("Using configuration from " + buildConfigJs);
        for (var key in customBuildConfig) {
            buildConfig[key] = customBuildConfig[key];
        }
    }
    catch (noBuildConfigFound) {
        grunt.verbose.writeln("Configuration file " + buildConfigJs + " not found - using the default configuration.");
    }

    grunt.verbose.write("Checking for bower_components...");
    if (grunt.file.isDir("bower_components")) {
        grunt.verbose.ok();
    }
    else {
        grunt.log.error("bower_components not found! Please run `bower install`.");
        process.exit();
    }

    pkg.window.toolbar = buildConfig.nwOptions.toolbar;

    grunt.initConfig({
        pkg: pkg,

        /*
         * Check JavaScript and CSS source files.
         */
        jshint: {
            options: {
                jshintrc: true
            },
            all: [ "js/**/*.js" ]
        },

        csslint: {
            options: {
                csslintrc: ".csslintrc"
            },
            all: [ "css/**/*.css" ]
        },

        /*
         * Automatic tests.
         */
        simplemocha: {
            options: {
                timeout: 3000,
                ignoreLeaks: false,
                ui: "bdd",
                reporter: "tap"
            },
            all: {
                src: ["test/**/*.mocha.js"]
            }
        },

        /*
         * Transpile JavaScript source files from ES6 to ES5
         */
        babel: {
            options: {
                whitelist: [
                    "es6.arrowFunctions",
                    "es6.properties.shorthand",
                    "es6.modules",
                    "es6.templateLiterals",
                    "es6.destructuring"
                ]
            },
            all: {
                files: [{
                    expand: true,
                    src: "js/**/*.js",
                    dest: "build"
                }]
            }
        },

        jspot: {
            options: {
                keyword: "_"
            },
            all: {
                // Exclude *.bundle.js and *.min.js
                src: ["build/js/**/*.js", "!build/js/*.*.js"],
                dest: "locales"
            }
        },

        po2json: {
            options: {
                singleFile: true,
                nodeJs: true,
                format: "jed1.x"
            },
            all: {
                src: ["locales/*.po"],
                dest: "build/js/locales.js",
            }
        },

        browserify: {
            editor: {
                options: {
                    external: ["nw.gui", "fs", "path", "process"]
                },
                src: [
                    "build/js/svg/*Handler.js",
                    "<%= nunjucks.player.dest %>",
                    "build/js/editor.js"
                ],
                dest: "build/js/editor.bundle.js"
            },
            player: {
                src: [
                    "build/js/player.js"
                ],
                dest: "build/js/player.bundle.js"
            }
        },

        /*
         * Compress the JavaScript code of the editor and player.
         */
        uglify: {
            options: buildConfig.uglifyOptions,
            editor: {
                src: "<%= browserify.editor.dest %>",
                dest: "build/js/editor.min.js"
            },
            player: {
                src: "<%= browserify.player.dest %>",
                dest: "build/js/player.min.js"
            }
        },

        /*
         * Precompile templates for the editor and player.
         */
        nunjucks_render: {
            player: {
                src: "templates/player.html",
                dest: "build/templates/player.html",
                context: {
                    playerJs: "<%= grunt.file.read('build/js/player.min.js') %>"
                }
            }
        },

        nunjucks: {
            player: {
                src: ["<%= nunjucks_render.player.dest %>"],
                dest: "build/templates/player.templates.js"
            }
        },

        copy: {
            editor: {
                files: [
                    {
                        expand: true,
                        src: [
                            "index.html",
                            "css/**/*",
                            "vendor/**/*",
                            "bower_components/**/*"
                        ],
                        dest: "build/app"
                    },
                    {
                        src: "build/package.json",
                        dest: "build/app/package.json"
                    },
                    {
                        src: "<%= uglify.editor.dest %>",
                        dest: "build/app/js/editor.min.js"
                    }
                ]
            },
            // This is a temporary workaround to force NW.js to apply
            // correct localization.
            // See: https://github.com/mllrsohn/node-webkit-builder/pull/213
            nw_locales: {
                files: [
                    {
                        expand: true,
                        cwd: "cache/" + buildConfig.nwVersion + "/linux32/locales",
                        src: ["*.pak"],
                        dest: "build/Sozi/linux32/locales"
                    },
                    {
                        expand: true,
                        cwd: "cache/" + buildConfig.nwVersion + "/linux64/locales",
                        src: ["*.pak"],
                        dest: "build/Sozi/linux64/locales"
                    },
                ]
            }
        },

        compress: {
            media: {
                options: {
                    mode: "zip",
                    archive: "build/Sozi-extras-media-<%= pkg.version %>.zip"
                },
                expand: true,
                cwd: "extras/media",
                src: ["**/*"]
            }
        },

        /*
         * Build node-webkit applications for various platforms.
         * The options take precedence over the targets variable
         * defined later.
         */

        nodewebkit: {
            options: {
                version: buildConfig.nwVersion,
                buildDir: "build",
                platforms: buildConfig.platforms
            },
            editor: ["build/app/**/*"]
        },

        /*
         * Upload the web demonstration of the Sozi editor.
         */
        rsync: {
            options: {
                args: ["--verbose", "--update"]
            },
            editor: {
                options: {
                    src: ["build/app/*"],
                    dest: "/var/www/sozi.baierouge.fr/demo/",
                    host: "www-data@baierouge.fr",
                    syncDest: true, // Delete files on destination
                    recursive: true
                }
            }
        },

        newer: {
            options: {
                override: function (details, include) {
                    if (details.task === "nunjucks_render" && details.target === "player") {
                        include(fs.statSync("build/js/player.min.js").mtime > details.time);
                    }
                    else {
                        include(false);
                    }
                }
            }
        }
    });

    /*
     * Compress options for target OS in nodewebkit task.
     */
    var targetConfig = {
        linux32: "tgz",
        linux64: "tgz",
        win32: "zip",
        win64: "zip",
        osx32: "zip",
        osx64: "zip"
    };

    /*
     * Compress enabled node-webkit applications
     * for various platforms.
     */
    buildConfig.platforms.forEach(function (targetName) {
        var prefix = "Sozi-" + pkg.version + "-" + targetName;

        grunt.config(["rename", targetName], {
            src: "build/Sozi/" + targetName,
            dest: "build/Sozi/" + prefix
        });

        grunt.config(["compress", targetName], {
            options: {
                mode: targetConfig[targetName],
                archive: "build/" + prefix + "." + targetConfig[targetName]
            },
            expand: true,
            cwd: "build/Sozi/",
            src: [prefix + "/**/*"]
        });
    });

    grunt.registerTask("write_package_json", function () {
        grunt.file.write("build/package.json", JSON.stringify(pkg));
    });

    grunt.registerMultiTask("nunjucks_render", function () {
        this.files.forEach(function (file) {
            grunt.file.write(file.dest, nunjucks.render(file.src[0], this.data.context));
            grunt.log.writeln("File " + file.dest + " created.");
        }, this);
    });

    grunt.registerTask("backends-web", function () {
        // grunt.config.merge does not work for this
        grunt.config.set("browserify.editor.src",
            grunt.config.get("browserify.editor.src").concat(backends.web)
        );
    });

    grunt.registerTask("backends-nw", function () {
        // grunt.config.merge does not work for this
        grunt.config.set("browserify.editor.src",
            grunt.config.get("browserify.editor.src").concat(backends.nw)
        );
    });

    grunt.registerTask("lint", ["jshint", "csslint"]);

    grunt.registerTask("build", [
        "write_package_json",
        "newer:babel",
        "browserify:player", // Cannot use 'newer' here due to imports
        "newer:uglify:player",
        "newer:nunjucks_render",
        "newer:nunjucks",
        "newer:po2json",
        "browserify:editor", // Cannot use 'newer' here due to imports
        "newer:uglify:editor",
        "newer:copy:editor"
    ]);

    grunt.registerTask("nw-build",  ["backends-nw", "build"]);
    grunt.registerTask("web-build", ["backends-web", "build"]);

    grunt.registerTask("nw-bundle", [
        "nw-build",
        "nodewebkit",
        "newer:copy:nw_locales",
        "rename",  // Cannot use 'newer' here since the generated file name includes the version
        "compress" // Cannot use 'newer' here since the generated file name includes the version
    ]);

    grunt.registerTask("web-demo", [
        "web-build",
        "rsync" // Cannot use 'newer' here since 'dest' is not a generated file
    ]);

    grunt.registerTask("pot", [
        "newer:babel",
        "jspot" // Cannot use 'newer' here since 'dest' is not a generated file
    ]);

    grunt.registerTask("default", ["nw-bundle"]);
};
