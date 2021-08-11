import { faBug, faCog, faToggleOff, faToggleOn } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import * as React from 'react';
import { Button } from 'toolkit/components/button';
import { GitHubLink } from 'toolkit/components/links';
import { Toggle } from 'toolkit/components/toggle';
import { localToolkitStorage } from 'toolkit/core/common/storage';
import { getBrowser, getBrowserName } from 'toolkit/core/common/web-extensions';
import { useDarkModeSetter } from 'toolkit/hooks/useDarkModeSetter';
import './styles.scss';

export function ToolkitPopup() {
  useDarkModeSetter();

  const { runtime, tabs } = getBrowser();
  const { version, name } = runtime.getManifest();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isToolkitDisabled, setIsToolkitDisabled] = React.useState(false);
  const handleToolkitDisabledChanged = React.useCallback(
    (_, isDisabled) => setIsToolkitDisabled(isDisabled),
    []
  );

  React.useEffect(() => {
    document.title = `${name} Popup`;
  }, []);

  React.useEffect(() => {
    localToolkitStorage.getFeatureSetting('DisableToolkit').then((isToolkitDisabled) => {
      setIsLoading(false);
      setIsToolkitDisabled(isToolkitDisabled);
    });

    localToolkitStorage.onToolkitDisabledChanged(handleToolkitDisabledChanged);

    return () => localToolkitStorage.offToolkitDisabledChanged(handleToolkitDisabledChanged);
  }, []);

  return isLoading ? null : (
    <div className="popup">
      <img
        onClick={() => {
          localToolkitStorage.setFeatureSetting('DisableToolkit', !isToolkitDisabled);
        }}
        className="logo"
        src={runtime.getURL(
          `assets/images/logos/toolkitforynab-logo-200${isToolkitDisabled ? '-disabled' : ''}.png`
        )}
      ></img>
      <h1 className="popup__title">
        The {name} is currently{' '}
        <span
          className={classNames({
            disabled: isToolkitDisabled,
          })}
        >
          {isToolkitDisabled ? 'disabled' : 'enabled'}
        </span>
        ! Click the logo to {isToolkitDisabled ? 'enable' : 'disable'}.
      </h1>
      <div className="popup__actions">
        <Button
          className="popup__action"
          onClick={() => {
            if (getBrowserName() === 'edge') {
              tabs.create({
                url: runtime.getURL('options/index.html'),
              });
            } else {
              runtime.openOptionsPage();
            }
          }}
        >
          <FontAwesomeIcon icon={faCog} /> Open Settings
        </Button>
        <GitHubLink>
          <Button className="popup__action">
            <FontAwesomeIcon icon={faBug} /> Report an Issue
          </Button>
        </GitHubLink>
      </div>
      <div>Version {version}</div>
    </div>
  );
}
