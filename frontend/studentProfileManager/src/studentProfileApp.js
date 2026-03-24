import React, {Fragment} from 'react';
import './App.css';
import StudentList from './studentProfileManagement/listAdminStudents';


function App() {
  return (
    <Fragment>
      <div className="container">
        <StudentList />
      </div>
    </Fragment>
  );
}

export default App;