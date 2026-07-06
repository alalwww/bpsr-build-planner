import './App.css';
import BuildPlanner from './build-planner/BuildPlanner';
import Footer from './Footer';
import { isTauri } from './platform';

function App() {
  return (
    <>
      <main>
        <BuildPlanner />
      </main>
      {!isTauri && <Footer />}
    </>
  );
}

export default App;
