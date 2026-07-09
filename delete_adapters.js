const fs = require('fs');
['c:/Users/sekkeiya/02-WebApp/040-sekkeiya/sekkeiya/src/shared/api/adapters/boardAdapters.js', 'c:/Users/sekkeiya/02-WebApp/040-sekkeiya/sekkeiya/packages/global-panel/src/api/adapters/boardAdapters.js'].forEach(p => {
  try {
    fs.unlinkSync(p);
    console.log('Deleted ' + p);
  } catch (err) {
    console.error('Error deleting ' + p + ':', err.message);
  }
});
