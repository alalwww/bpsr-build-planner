import './App.css';
import BuildPlanner from './build-planner/BuildPlanner';
import ErrorBoundary from './components/ErrorBoundary';
import Footer from './Footer';
import { isTauri } from './platform';

function App() {
  return (
    <>
      <main>
        <ErrorBoundary>
          <BuildPlanner />
        </ErrorBoundary>
      </main>
      {!isTauri && <Footer />}
    </>
  );
}

export default App;
