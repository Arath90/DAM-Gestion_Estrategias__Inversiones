import { ENTITY_CONFIG } from '../config/entityConfig';
import GenericCrudView from '../components/views/GenericCrudView';

const InstrumentsPage = () => (
  <GenericCrudView
    entityName="Instruments"
    entityConfig={ENTITY_CONFIG.Instruments}
  />
);

export default InstrumentsPage;