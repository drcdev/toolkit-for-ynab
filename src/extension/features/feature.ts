import { observeListener, routeChangeListener } from 'toolkit/extension/listeners';
import { logToolkitError } from 'toolkit/core/common/errors/with-toolkit-error';

export class Feature {
  featureName = this.constructor.name as FeatureName;

  settings = {
    enabled: ynabToolKit.options[this.featureName],
  };

  shouldInvoke(): boolean {
    // Default to no action. Unless you're implementing a CSS only feature,
    // you MUST override this to specify when your invoke() function should run!
    return false;
  }

  willInvoke(): void | Promise<void> {
    /* stubbed optional hook for logic that must happen for a feature
    to work but doesn't need to happen on every invoke */
  }

  invoke(): void {
    throw Error(`Feature: ${this.featureName} does not implement required invoke() method.`);
  }

  destroy(): void {
    /* stubbed, most features don't support destroy yet */
  }

  injectCSS(): string {
    /* stubbed, default to no injected CSS */
    return '';
  }

  logError(exception: Error): void {
    logToolkitError({
      exception,
      featureName: this.featureName,
      featureSetting: this.settings.enabled,
    });
  }

  observe(): void {
    /* stubbed listener function */
  }

  onRouteChanged(): void {
    /* stubbed listener function */
  }

  onBudgetChanged(): void {
    /* stubbed listener function */
  }

  applyListeners(): void {
    observeListener.addFeature(this);
    routeChangeListener.addFeature(this);
  }

  removeListeners(): void {
    observeListener.removeFeature(this);
    routeChangeListener.removeFeature(this);
  }
}
