import * as React from 'react';
import * as PropTypes from 'prop-types';
import './styles.scss';

export const LabeledRadio = ({ id, checked, disabled, label, onChange }) => {
  return (
    <label className="tk-labeled-radio tk-flex tk-align-items-center">
      <input checked={checked} name={id} onChange={onChange} disabled={disabled} type="radio" />
      <span className="tk-mg-l-05">{label}</span>
    </label>
  );
};

LabeledRadio.propTypes = {
  id: PropTypes.string.isRequired,
  checked: PropTypes.bool.isRequired,
  disabled: PropTypes.bool,
  label: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

LabeledRadio.defaultProps = {
  disabled: false,
};
