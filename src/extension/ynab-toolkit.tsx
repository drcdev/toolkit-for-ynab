import * as React from 'react';
import { features } from 'toolkit/extension/features';
import * as ynabUtils from 'toolkit/extension/utils/ynab';
import * as emberUtils from 'toolkit/extension/utils/ember';
import * as Collections from 'toolkit/extension/utils/collections';
import { isFeatureEnabled } from 'toolkit/extension/utils/feature';
import { getToolkitStorageKey, setToolkitStorageKey } from 'toolkit/extension/utils/toolkit';
import { logToolkitError, withToolkitError } from 'toolkit/core/common/errors/with-toolkit-error';
import { forEachRenderedComponent } from './utils/ember';
import { compareSemanticVersion } from './utils/helpers';
import { componentAppend } from './utils/react';
import { ToolkitReleaseModal } from 'toolkit/core/components/toolkit-release-modal';
import { Feature } from './features/feature';
import { InboundMessage, InboundMessageType, OutboundMessageType } from 'toolkit/core/messages';

let hasToolkitLoaded = false;
export const TOOLKIT_LOADED_MESSAGE = 'ynab-toolkit-loaded';
export const TOOLKIT_BOOTSTRAP_MESSAGE = 'ynab-toolkit-bootstrap';

export type SupportedEmberHook = 'didRender' | 'didInsertElement' | 'didUpdate';

export const EMBER_COMPONENT_TOOLKIT_HOOKS: SupportedEmberHook[] = [
  'didRender',
  'didInsertElement',
  'didUpdate',
];
export const emberComponentToolkitHookKey = (
  hookName: SupportedEmberHook
): `_tk_${SupportedEmberHook}_hooks_` => `_tk_${hookName}_hooks_`;

window.__toolkitUtils = {
  ...ynabUtils,
  ...emberUtils,
  ...Collections,
};

interface ToolkitEmberHook {
  context: Feature;
  fn(element: Element): void;
}

type ToolkitEnabledComponent = Ember['Component'] & {
  element?: Element;
  _tk_didRender_hooks_?: ToolkitEmberHook[];
  _tk_didInsertElement_hooks_?: ToolkitEmberHook[];
  _tk_didUpdate_hooks_?: ToolkitEmberHook[];
};

export class YNABToolkit {
  private featureInstances: Feature[] = [];

  public initializeToolkit() {
    window.addEventListener('message', this.onBackgroundMessage);
    window.postMessage({ type: OutboundMessageType.ToolkitLoaded }, '*');
  }

  private applyFeatureCSS() {
    $('head').append(
      $('<style>', { id: 'tk-global-styles', type: 'text/css' }).text(require('./ynab-toolkit.css'))
    );

    this.featureInstances.forEach((feature) => {
      if (isFeatureEnabled(feature.settings.enabled)) {
        this.injectFeatureCSS(feature);
      }
    });
  }

  private injectFeatureCSS(featureInstance: Feature) {
    const wrappedInjectCSS = withToolkitError(
      featureInstance.injectCSS.bind(featureInstance),
      featureInstance
    );

    const featureStyleID = `tk-feature-styles-${featureInstance.constructor.name}`;
    const featureCSS = wrappedInjectCSS();
    const featureStyle = $('<style>', {
      id: featureStyleID,
      type: 'text/css',
    }).text(featureCSS);

    if (featureCSS) {
      const existingStyle = document.querySelector(`#${featureStyleID}`);
      if (existingStyle) {
        $(existingStyle).replaceWith(featureStyle);
      } else {
        $('head').append(featureStyle);
      }
    }
  }

  private invokeFeature = (featureName: FeatureName) => {
    const feature = this.featureInstances.find((f) => f.constructor.name === featureName);
    const wrappedShouldInvoke = feature.shouldInvoke.bind(feature);
    const wrappedInvoke = feature.invoke.bind(feature);
    if (isFeatureEnabled(feature.settings.enabled) && wrappedShouldInvoke()) {
      wrappedInvoke();
    }
  };

  private destroyFeature = (featureName: FeatureName) => {
    document.head.querySelector(`#tk-feature-styles-${featureName}`)?.remove();
    const feature = this.featureInstances.find((f) => f.constructor.name === featureName);
    feature.removeListeners();
    feature.removeToolkitEmberHooks();

    const wrappedDestroy = feature.destroy.bind(feature);
    wrappedDestroy();
  };

  private invokeFeatureInstances = async () => {
    this.featureInstances.forEach(async (feature) => {
      if (isFeatureEnabled(feature.settings.enabled)) {
        feature.applyListeners();

        try {
          await feature.willInvoke();
        } catch (exception) {
          const featureName = feature.constructor.name as FeatureName;
          const featureSetting = window.ynabToolKit.options[featureName];
          logToolkitError({
            exception,
            featureName,
            featureSetting,
            functionName: 'willInvoke',
          });
        }

        const wrappedShouldInvoke = withToolkitError(feature.shouldInvoke.bind(feature), feature);
        const wrappedInvoke = withToolkitError(feature.invoke.bind(feature), feature);
        if (wrappedShouldInvoke()) {
          wrappedInvoke();
        }
      }
    });
  };

  private onBackgroundMessage = (event: InboundMessage) => {
    if (event.source !== window) {
      return;
    }

    switch (event.data.type) {
      case InboundMessageType.Bootstrap: {
        window.ynabToolKit = {
          ...window.ynabToolKit,
          ...event.data.ynabToolKit,
          hookedComponents: new Set(),
        };

        this.setupErrorTracking();
        features.forEach((Feature) => this.featureInstances.push(new Feature()));
        this._waitForUserSettings();
        break;
      }
      case InboundMessageType.SettingChanged: {
        const { name, value } = event.data.setting;
        if (name === 'DisableToolkit' && value) {
          document.location.reload();
          break;
        }

        const featureInstance = this.featureInstances.find(
          ({ constructor }) => constructor.name === name
        );

        if (featureInstance) {
          featureInstance.settings.enabled = value;

          if (isFeatureEnabled(value)) {
            this.injectFeatureCSS(featureInstance);
            featureInstance.applyListeners();
            this.invokeFeature(name);
          } else {
            this.destroyFeature(name);
          }
        }

        break;
      }
    }
  };

  private setupErrorTracking = () => {
    window.addEventListener('error', ({ error }) => {
      let serializedError = '';
      if (error.message && error.stack) {
        serializedError = `${error.message}\n${error.stack.toString()}`;
      } else if (error.message) {
        serializedError = error.message;
      }

      if (serializedError.includes(window.ynabToolKit.extensionId)) {
        logToolkitError({
          exception: error,
          featureName: 'unknown',
          featureSetting: 'unknown',
          functionName: 'global',
        });
      }
    });
  };

  private addToolkitEmberHooks = () => {
    EMBER_COMPONENT_TOOLKIT_HOOKS.forEach((lifecycleName) => {
      Ember.Component.prototype[lifecycleName] = function () {
        const self = this as ToolkitEnabledComponent;
        const hooks = self[emberComponentToolkitHookKey(lifecycleName)];
        if (hooks) {
          hooks.forEach(({ context, fn }) => fn.call(context, self.element));
        }
      };
    });
  };

  private invokeAllHooks = () => {
    window.ynabToolKit.hookedComponents.forEach((key) => {
      forEachRenderedComponent(key, (view: ToolkitEnabledComponent) => {
        EMBER_COMPONENT_TOOLKIT_HOOKS.forEach((lifecycleName) => {
          const hooks = view[emberComponentToolkitHookKey(lifecycleName)];
          if (hooks) {
            hooks.forEach((hook) => hook.fn.call(hook.context, view.element));
          }
        });
      });
    });
  };

  private showReleaseModal = () => {
    componentAppend(
      <div id="tk-modal-container">
        <ToolkitReleaseModal
          onClose={() => document.querySelector('#tk-modal-container').remove()}
        />
      </div>,
      document.querySelector('.layout')
    );
  };

  private checkReleaseVersion = () => {
    const latestVersionKey = `latest-version-${ynabToolKit.environment}`;
    let latestVersion = getToolkitStorageKey(latestVersionKey);
    if (!latestVersion) {
      setToolkitStorageKey(latestVersionKey, ynabToolKit.version);
      return;
    }

    if (compareSemanticVersion(latestVersion, ynabToolKit.version) === -1) {
      setToolkitStorageKey(latestVersionKey, ynabToolKit.version);
      this.showReleaseModal();
    }
  };

  _waitForUserSettings() {
    const self = this;

    (function poll() {
      if (ynabUtils.isYNABReady()) {
        // add a global invokeFeature to the global ynabToolKit for legacy features
        // once legacy features have been removed, this should be a global exported function
        // from this file that features can require and use
        ynabToolKit.invokeFeature = self.invokeFeature;

        self.addToolkitEmberHooks();

        if (!ynabToolKit.options['DisableToolkit']) {
          // inject the global css from each feature into the HEAD of the DOM
          self.applyFeatureCSS();

          self.checkReleaseVersion();

          // Hook up listeners and then invoke any features that are ready to go.
          self.invokeFeatureInstances();

          Ember.run.later(self.invokeAllHooks, 100);

          hasToolkitLoaded = true;
        }
      } else if (typeof Ember !== 'undefined') {
        Ember.run.later(poll, 250);
      } else {
        setTimeout(poll, 250);
      }
    })();
  }
}
