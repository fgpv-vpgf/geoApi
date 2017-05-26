const webpack   = require('webpack');
const path      = require('path');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = function (env) {

    const config = {
        entry: {
            'index': path.resolve(__dirname, 'src/index.js')
        },

        output: {
            path: path.resolve(__dirname, 'build'),
            filename: '[name].js'
        },

        devtool: 'eval-source-map',
        target: 'node',

        module: {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: [{
                        loader: 'babel-loader',
                        options: { presets: ['es2015'] }
                    }]
                }
            ]
        },

        plugins: [
            new webpack.optimize.UglifyJsPlugin({
                compress: {
                    warnings: false,
                    screw_ie8 : true
                },
                mangle: {
                    screw_ie8 : true
                }
            }),

            new webpack.DefinePlugin({
                'process.env': {
                    'NODE_ENV': JSON.stringify('production')
                }
            }),

            new BundleAnalyzerPlugin()
        ]
    };

    return config;
}
