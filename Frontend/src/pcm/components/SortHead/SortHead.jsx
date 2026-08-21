import Icon from '../Icon/Icon.jsx';

// Shared sortable column header — click toggles asc/desc on that column.
// Styled by the `.sort-th` / `.sort-icon` rules in SummaryTable.css, which
// are written against `.pcm-root` rather than `.summary-table` and so apply
// here too.
export default function SortHead({ label, sortKey, active, dir, onSort, className }) {
  return (
    <th scope="col" className={className} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button className="sort-th" type="button" onClick={() => onSort(sortKey)}>
        {label}
        <Icon
          name="chevron-down"
          sm
          className={'sort-icon' + (active ? ' is-active' : '') + (active && dir === 'asc' ? ' is-asc' : '')}
        />
      </button>
    </th>
  );
}
