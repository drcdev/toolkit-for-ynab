import * as ReactDOM from 'react-dom';
import * as React from 'react';
import { ToolkitOptions } from './toolkit-options';
import 'toolkit/core/common/styles/utils.scss';
import { localToolkitStorage } from '../common/storage';

localToolkitStorage.getFeatureSetting('options.dark-mode').then((isDarkModeEnabled) => {
  if (isDarkModeEnabled) {
    document.querySelector('html').dataset['theme'] = 'dark';
  }

  ReactDOM.render(<ToolkitOptions />, document.getElementById('root'));
});
