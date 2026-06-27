export default function PipelineAnimation() {
  return (
    <div className="pa-wrap" aria-hidden="true">
      <div className="pa-scene">
        <div className="pa-core">
          <div className="pa-plate pa-plate--data">
            <span className="pa-num pa-num--1">1</span>
          </div>
          <div className="pa-plate pa-plate--model">
            <span className="pa-num pa-num--2">2</span>
          </div>
          <div className="pa-plate pa-plate--insight">
            <span className="pa-num pa-num--3">3</span>
          </div>
        </div>
        <span className="pa-core-label pa-core-label--1">1</span>
        <span className="pa-core-label pa-core-label--2">2</span>
        <span className="pa-core-label pa-core-label--3">3</span>
        <div className="pa-shard pa-shard--1">
          <span className="pa-num">4</span>
        </div>
        <div className="pa-shard pa-shard--2">
          <span className="pa-num">5</span>
        </div>
        <div className="pa-shard pa-shard--3">
          <span className="pa-num">6</span>
        </div>
        <div className="pa-shard pa-shard--4">
          <span className="pa-num">7</span>
        </div>
        <div className="pa-shard pa-shard--5">
          <span className="pa-num">8</span>
        </div>
        <div className="pa-shard pa-shard--6">
          <span className="pa-num">9</span>
        </div>
      </div>
    </div>
  );
}
