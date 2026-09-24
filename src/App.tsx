import './App.css';
import BuildPlanner from './build-planner/BuildPlanner';
import ShortUrlImporter from './build-planner/plan/ShortUrlImporter';
import ErrorBoundary from './components/ErrorBoundary';
import Footer from './Footer';
import MobileNotice from './mobile-notice/MobileNotice';
import { isTauri } from './platform';
import UpdateChecker from './updater/UpdateChecker';

function App() {
  return (
    <>
      {!isTauri && <MobileNotice />}
      <main>
        <ErrorBoundary>
          <BuildPlanner />
        </ErrorBoundary>
      </main>
      {!isTauri && <Footer />}
      {!isTauri && <ShortUrlImporter />}
      {isTauri && <UpdateChecker />}
    </>
  );
}

export default App;
