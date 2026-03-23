export default function Loader({ text = 'Loading data...' }) {
  return (
    <div className="loader-wrapper">
      <div className="loader-spinner">
        <div className="spinner-ring" />
        <div className="spinner-ring spinner-ring-2" />
        <div className="spinner-core" />
      </div>
      <p className="loader-text">{text}</p>
    </div>
  );
}
