module.exports = {
  name: 'DisplayTargetGoalAmount',
  type: 'select',
  default: false,
  section: 'budget',
  title: 'Display Target Goal Amount And Overbudget Warning',
  description:
    "Adds a 'Goal' column which displays the target goal amount for every category with a goal, and a warning in red if you have budgeted beyond your goal.",
  options: [
    { name: 'Display goal amount and warn of overbudget with red', value: '1' },
    { name: 'Display goal amount and show funded goals as green', value: '2' },
    { name: 'Display goal amount with no emphasis', value: '3' },
  ],
};
