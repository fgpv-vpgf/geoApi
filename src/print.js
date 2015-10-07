;(function (root, factory) {

  if (typeof define === 'function' && define.amd) {
    define(['esri/tasks/PrintParameters', 'esri/tasks/PrintTemplate',
     'esri/tasks/PrintTask'], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory(require('esri/tasks/PrintParameters'),
     require('esri/tasks/PrintTemplate'),
     require('esri/tasks/PrintTask'));
  } else {
    root.printService = factory(root.PrintParameters);
  };

}(this, function (exportURL) {
    printTask = new PrintTask(exportURL);
    template = new PrintTemplate();
    template.exportOptions = {
        width: mapDom.clientWidth,
        height: mapDom.clientHeight,
        dpi: 96,
    };
    template.format = 'PNG32';
    template.layout = 'MAP_ONLY';
    template.showAttribution = false;
    params = new PrintParameters();
    params.template = template;

    console.log('submitting print job.  please wait');
    printTask.execute(params);

  return {};
}));
