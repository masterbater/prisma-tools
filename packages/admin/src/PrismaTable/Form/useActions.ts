import { useMutation } from '@apollo/client';
import { useContext } from 'react';
import { TableContext } from '../Context';
import { FormProps } from './index';
import { mutationDocument } from '../QueryDocument';
import { SchemaModel } from '../../types';
import { SchemaField } from '@paljs/types';

export const getValueByType = (
  value: string,
  field?: SchemaField,
  create = false,
) => {
  if (field?.type === 'Json') {
    const result = value ? JSON.parse(value) : field.list ? [] : {};
    return field.list ? { set: result } : result;
  }
  if (field?.list) {
    if (!value) {
      return { set: [] };
    }
    const result: any[] = value.split(',');
    switch (field?.type) {
      case 'Int':
        result.forEach((value1, index) => {
          result[index] = parseInt(value1);
        });
        break;
      case 'Float':
        result.forEach((value1, index) => {
          result[index] = parseFloat(value1);
        });
        break;
      case 'Boolean':
        result.forEach((value1, index) => {
          result[index] = value1 === 'true';
        });
        break;
    }
    return { set: result };
  } else {
    const result =
      field?.type === 'Int'
        ? parseInt(value)
        : field?.type === 'Float'
        ? parseFloat(value)
        : value;
    return create ? result : { set: result };
  }
};

const useActions = (
  model: SchemaModel,
  data: any,
  action: FormProps['action'],
  onSave: () => void,
) => {
  const {
    schema: { models },
    valueHandler,
  } = useContext(TableContext);
  const [updateModel, { loading: updateLoading }] = useMutation(
    mutationDocument(models, model.id, 'update'),
  );
  const [createModel, { loading: createLoading }] = useMutation(
    mutationDocument(models, model.id, 'create'),
  );
  const getField = (name: string) => {
    return model.fields.find((item) => item.name === name);
  };

  const onUpdateHandler = (newData: any) => {
    const updateData: any = {};

    Object.keys(newData).forEach((key) => {
      const field = getField(key);
      if (field?.update) {
        if (field.kind === 'object') {
          const fieldModel = models.find((item) => item.id === field.type)!;
          if (
            (newData[key] && !data[key]) ||
            (newData[key] &&
              newData[key][fieldModel.idField] !==
                data[key][fieldModel.idField])
          ) {
            const editField = fieldModel.fields.find(
              (item) => item.name === fieldModel.idField,
            )!;
            updateData[key] = {
              connect: {
                id: getValueByType(newData[key][fieldModel.idField], editField),
              },
            };
          } else if (!newData[key] && data[key]) {
            updateData[key] = { disconnect: true };
          }
        } else if (newData[key] !== data[key]) {
          updateData[key] = valueHandler
            ? valueHandler(newData[key], field)
            : getValueByType(newData[key], field);
        }
      }
    });
    if (Object.keys(updateData).length > 0) {
      updateModel({
        variables: {
          where: {
            id: data.id,
          },
          data: updateData,
        },
      }).then(() => {
        onSave();
      });
    }
  };

  const onCreateHandler = (newData: any) => {
    const createData: any = {};
    Object.keys(newData).forEach((key) => {
      const field = getField(key);
      if (field?.kind === 'object') {
        const fieldModel = models.find((item) => item.id === field.type)!;
        const editField = fieldModel.fields.find(
          (item) => item.name === fieldModel.idField,
        )!;
        if (newData[key]) {
          createData[key] = {
            connect: {
              id: getValueByType(
                newData[key][fieldModel.idField],
                editField,
                true,
              ),
            },
          };
        }
      } else {
        createData[key] = valueHandler
          ? valueHandler(newData[key], field, true)
          : getValueByType(newData[key], field, true);
      }
    });
    createModel({
      variables: {
        data: createData,
      },
    }).then(() => {
      onSave();
    });
  };

  const onSubmit = (newData: any) => {
    action === 'create' ? onCreateHandler(newData) : onUpdateHandler(newData);
  };

  return {
    onSubmit,
    loading: updateLoading || createLoading,
  };
};

export default useActions;
