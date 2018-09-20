import {createQuery} from './createQuery';
import {createFilter} from './createFilter';

const mapToObject = (aMap) => {
  const obj = {};
  aMap.forEach((v,k) => { obj[k] = v; });
  return obj;
};

const queryToOdataString = (query): string => {
  let result = '';
  for (let key in query) {
    if (key.startsWith('$')) {
      if (result !== '') {
        result += '&';
      }
      result += `${key}=${query[key]}`;
    }
  }
  return result;
};

const executeQueryByQueryBuilder = async (inputQueryBuilder, query, options: any) => {
  const alias = options.alias || 'typeorm_query';
  const filter = createFilter(query.$filter, {alias: alias});
  let odataQuery: any = {};
  if (query) {
    const odataString = queryToOdataString(query);
    if (odataString) {
      odataQuery = createQuery(odataString);
    }
  }

  let queryBuilder = inputQueryBuilder;
  queryBuilder = queryBuilder
    .where(odataQuery.where)
    .setParameters(mapToObject(filter.parameters));

  if (odataQuery.select && odataQuery.select != '*') {
    queryBuilder = queryBuilder.select(odataQuery.select.split(',').map(i => i.trim()));
  }

  if (odataQuery.orderby) {
    const orders = odataQuery.orderby.split(',').map(i => i.trim());
    orders.forEach((item) => {
      queryBuilder = queryBuilder.addOrderBy(...(item.split(' ')));
    });
  }
  queryBuilder = queryBuilder.skip(query.$skip || 0);
  if (query.$top) {
    queryBuilder = queryBuilder.take(query.$top);
  }
  if (query.$count && query.$count !== 'false') {
    const resultData = await queryBuilder.getManyAndCount();
    return {
      items: resultData[0],
      count: resultData[1]
    }
  }

  return queryBuilder.getMany();
};

function odataQuery(repository: any) {
  return async (req: any, res: any, next) => {
    try {
      //const repository = getRepository(type);
      const alias = 'typeorm_query';
      const queryBuilder = repository.createQueryBuilder(alias);
      const result = await executeQueryByQueryBuilder(queryBuilder, req.query, {});

      res.status(200).json(result);
    } catch (e) {
      res.status(500).json({message: 'Internal server error.', error: {message: e.message}});
    }
    return next();
  }
}

export {odataQuery};