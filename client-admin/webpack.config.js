// Copyright (C) 2012-present, The Authors. This program is free software: you can redistribute it and/or  modify it under the terms of the GNU Affero General Public License, version 3, as published by the Free Software Foundation. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details. You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <http://www.gnu.org/licenses/>.

var path = require("path");
var webpack = require("webpack");
var CompressionPlugin = require('compression-webpack-plugin');
var LodashModuleReplacementPlugin = require('lodash-webpack-plugin');
var HtmlWebPackPlugin = require('html-webpack-plugin');
var EventHooksPlugin = require('event-hooks-webpack-plugin');
var CopyPlugin = require("copy-webpack-plugin");
var TerserPlugin = require("terser-webpack-plugin");
var glob = require('glob');
var fs = require('fs');

const outputDirectory = 'dist'

var polisConfig = require("./polis.config");

/**
 * Generates .headersJson files alongside files served by the file-server. Reading these files instructs file-server
 * what HTML headers should be added to each file.
 * 
 * @deprecated
 */
function writeHeadersJsonForOutputFiles(isDev) {
  function writeHeadersJson(matchGlob, headersData = {}) {
    const files = glob.sync(path.resolve(__dirname, outputDirectory, matchGlob))
    files.forEach((f, i) => {
      const headersFilePath = f + '.headersJson'
      fs.writeFileSync(headersFilePath, JSON.stringify(headersData))
    })
  }

  function writeHeadersJsonHtml() {
    const headersData = {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': isDev ? 'no-cache' : 'public,max-age=3600,s-maxage=3600'
    }
    writeHeadersJson('*.html', headersData)
  }

  function writeHeadersJsonJs() {
    const headersData = {
      ...(!isDev && { 'Content-Encoding': 'gzip' }),
      'Content-Type': 'application/javascript',
      'Cache-Control': isDev ? 'no-cache' : 'public,max-age=3600,s-maxage=3600'
    }
    writeHeadersJson('js/*.js', headersData)
    writeHeadersJson('*.js', headersData)
  }

  function writeHeadersJsonCss() {
    const headersData = {
      ...(!isDev && { 'Content-Encoding': 'gzip' }),
      'Content-Type': 'text/css',
      'Cache-Control':isDev ? 'no-cache' : 'public,max-age=3600,s-maxage=3600'
    }
    writeHeadersJson('css/*.css', headersData)
  }

  function writeHeadersJsonSvg() {
    const headersData = {
      ...(!isDev && { 'Content-Encoding': 'gzip' }),
      'Content-Type': 'image/svg+xml',
      'Cache-Control':isDev ? 'no-cache' : 'public,max-age=3600,s-maxage=3600'
    }
    writeHeadersJson('images/**/*.svg', headersData)
  }

  function writeHeadersJsonPng() {
    const headersData = {
      'Content-Type': 'image/png',
      'Cache-Control':isDev ? 'no-cache' : 'public,max-age=3600,s-maxage=3600'
    }
    writeHeadersJson('images/**/*.png', headersData)
  }

  function writeHeadersJsonMisc() {
    const headersData = {
      'Content-Type': 'image/vnd.microsoft.icon',
      'Cache-Control':isDev ? 'no-cache' : 'public,max-age=3600,s-maxage=3600'
    }
    writeHeadersJson('favicon.ico', headersData)
  }

  writeHeadersJsonCss()
  writeHeadersJsonHtml()
  writeHeadersJsonJs()
  writeHeadersJsonSvg()
  writeHeadersJsonPng()
  writeHeadersJsonMisc()
}

module.exports = (env, options) => {
  var isDevBuild = options.mode === 'development';
  var isDevServer = process.env.WEBPACK_SERVE;
  var chunkHashFragment = (isDevBuild || isDevServer) ? '' : '.[chunkhash:8]';
  return {
    entry: ["./src/index"],
    output: {
      publicPath: '/',
      filename: `js/admin_bundle${chunkHashFragment}.js`,
      path: path.resolve(__dirname, outputDirectory),
      clean: true,
    },
    resolve: {
      extensions: [".js", ".css", ".png", ".svg"],
    },
    devServer: {
      historyApiFallback: true,
      /**
      // TODO: Set up API proxy later for server component.
      // See: https://webpack.js.org/configuration/dev-server/#devserverproxy
      proxy: {
        '/api': {
        target: 'https://pol.is',
        secure: false,
        },
      },
      **/
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: 'public', globOptions: { ignore: ['**/index.html']}},
          { from: path.resolve(__dirname, 'node_modules', 'twemoji-emojis', 'vendor'), to: 'images/twemoji/' },
        ],
      }),
      new HtmlWebPackPlugin({
        template: path.resolve( __dirname, 'public/index.html' ),
        filename: (isDevBuild || isDevServer) ? 'index.html' : 'index_admin.html',
        inject: "body",
        templateParameters: {
          enableTwitter: polisConfig.ENABLE_TWITTER,
          enableFacebook: polisConfig.ENABLE_FACEBOOK,
          fbAppId: polisConfig.FB_APP_ID
        },
      }),
      new LodashModuleReplacementPlugin({
        currying: true,
        flattening: true,
        paths: true,
        placeholders: true,
        shorthands: true
      }),
      new EventHooksPlugin({
        afterEmit: () => {
          console.log('Writing *.headersJson files...')
          writeHeadersJsonForOutputFiles(isDevBuild || isDevServer)
        }
      }),
      // Only compress and create headerJson files during production builds.
      ...((isDevBuild || isDevServer) ? [] : [
        new CompressionPlugin({
          test: /\.js$/,
          // Leave unmodified without gz ext.
          // See: https://webpack.js.org/plugins/compression-webpack-plugin/#options
          filename: '[path][base]',
          deleteOriginalAssets: true,
        })
      ])
    ],
    optimization: {
      minimize: !isDevBuild,
      minimizer: [new TerserPlugin()],
    },
    module: {
      rules: [
        {
          test: /\.m?js$/,
          exclude: /(node_modules|bower_components)/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env', '@babel/preset-react'],
            },
          },
        },
        {
          test: /\.(png|jpg|gif|svg)$/,
          loader: 'file-loader',
        },
        {
          test: /\.mdx?$/,
          use: ['babel-loader', '@mdx-js/loader']
        }
      ],
    },
  };
}
